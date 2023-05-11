"use strict"

const { Level } = require('level')
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const EC = require("elliptic").ec, ec = new EC("secp256k1")

const Transaction = require("./transaction")
const { buildMerkleTree } = require("./merkle")
const { BLOCK_REWARD, BLOCK_GAS_LIMIT, EMPTY_HASH } = require("../config.json")
const drisscript = require("./runtime")
const { indexTxns } = require("../utils/utils")

class Block {
    constructor(
        blockNumber = 1,
        timestamp = Date.now(),
        transactions = [],
        difficulty = 1,
        parentHash = "",
        coinbase = ""
    ) {
        Object.assign(this, {
            blockNumber,
            timestamp,
            transactions,
            difficulty,
            parentHash,
            nonce: 0,
            txRoot: buildMerkleTree(indexTxns(transactions)).val,
            coinbase,
        })
        this.hash = Block.getHash(this)
    }
    /**
     * Generates a hash of a block by concatenating various properties of the block and hashing 
     * the resulting string using SHA256.
     * */
    static getHash(block) {
        return SHA256(
            block.blockNumber.toString() +
            block.timestamp.toString() +
            block.txRoot +
            block.difficulty.toString() +
            block.parentHash +
            block.nonce.toString()
        )
    }
    /**
     * Checks if a block has valid property types.
     * */
    static hasValidPropTypes(block) {
        return (
            Array.isArray(block.transactions) && typeof block.blockNumber === "number" &&
            typeof block.timestamp === "number" && typeof block.difficulty === "number" &&
            typeof block.parentHash === "string" && typeof block.nonce === "number" &&
            typeof block.txRoot === "string" && typeof block.hash === "string"
        )
    }
    /**
     * --------------------------------------------------------------------------------
     * Verifies the validity of the transactions in a given block and updates the state 
     * of the blockchain accordingly.It loops through all the transactions in the block 
     * and checks if each transaction is valid using the `isValid` method from the 
     * `Transaction` class. If any transaction is invalid, the method returns `false`.
     * --------------------------------------------------------------------------------
     * 
     * -----------------------------------------------------------------------------------
     * Checks if the sender's address exists in the stateDB. If the sender's address 
     * doesn't exist, it returns `false`. If the address exists, the method retrieves the 
     * sender's state from the stateDB and checks if the sender's code hash is empty. 
     * If it's not empty, the method returns `false`. Otherwise, it deducts the amount of 
     * the transaction, gas, and contract gas from the sender's balance and updates the 
     * sender's state.
     * -----------------------------------------------------------------------------------
     * 
     * ------------------------------------------------------------------------------------
     * If the transaction is a contract deployment, it sets the sender's code hash to the 
     * hash of the smart contract body and adds the code to the `code` object. It then 
     * updates the sender's nonce.
     * ------------------------------------------------------------------------------------
     * */
    static async verifyTxAndTransit(block, stateDB, codeDB, enableLogging = false) {
        for (const tx of block.transactions) {
            if (!(await Transaction.isValid(tx, stateDB))) return false
        }

        // Get all existing addresses
        const addressesInBlock = block.transactions.map(tx => SHA256(Transaction.getPubKey(tx)))
        const existedAddresses = await stateDB.keys().all()

        // If senders' address doesn't exist, return false
        if (!addressesInBlock.every(address => existedAddresses.includes(address))) return false

        // Start state replay to check if transactions are legit
        let states = {}, code = {}, storage = {}

        for (const tx of block.transactions) {
            const txSenderPubkey = Transaction.getPubKey(tx)
            const txSenderAddress = SHA256(txSenderPubkey)

            if (!states[txSenderAddress]) {
                const senderState = await stateDB.get(txSenderAddress)

                states[txSenderAddress] = senderState

                code[senderState.codeHash] = await codeDB.get(senderState.codeHash)

                if (senderState.codeHash !== EMPTY_HASH) return false

                states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
            } else {
                if (states[txSenderAddress].codeHash !== EMPTY_HASH) return false

                states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
            }

            // Contract deployment
            if (
                states[txSenderAddress].codeHash === EMPTY_HASH &&
                typeof tx.additionalData.scBody === "string"
            ) {
                states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
                code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
            }

            // Update nonce
            states[txSenderAddress].nonce += 1

            if (BigInt(states[txSenderAddress].balance) < 0n) return false

            if (!existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
                states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
                code[EMPTY_HASH] = ""
            }

            if (existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
                states[tx.recipient] = await stateDB.get(tx.recipient)
                code[states[tx.recipient].codeHash] = await codeDB.get(states[tx.recipient].codeHash)
            }

            states[tx.recipient].balance = (BigInt(states[tx.recipient].balance) + BigInt(tx.amount)).toString()

            // Contract execution
            if (states[tx.recipient].codeHash !== EMPTY_HASH) {
                const contractInfo = { address: tx.recipient }

                const [newState, newStorage] = await drisscript(code[states[tx.recipient].codeHash], states, BigInt(tx.additionalData.contractGas || 0), stateDB, block, tx, contractInfo, enableLogging)

                for (const account of Object.keys(newState)) {
                    states[account] = newState[account]
                }

                storage[tx.recipient] = newStorage
            }
        }

        // Reward

        if (!existedAddresses.includes(block.coinbase) && !states[block.coinbase]) {
            states[block.coinbase] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
            code[EMPTY_HASH] = ""
        }

        if (existedAddresses.includes(block.coinbase) && !states[block.coinbase]) {
            states[block.coinbase] = await stateDB.get(block.coinbase)
            code[states[block.coinbase].codeHash] = await codeDB.get(states[block.coinbase].codeHash)
        }

        let gas = 0n

        for (const tx of block.transactions) { gas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0) }

        states[block.coinbase].balance = (BigInt(states[block.coinbase].balance) + BigInt(BLOCK_REWARD) + gas).toString()

        // Finalize state and contract storage into DB

        for (const address in storage) {
            const storageDB = new Level(__dirname + "/../log/accountStore/" + address)
            const keys = Object.keys(storage[address])

            states[address].storageRoot = buildMerkleTree(keys.map(key => key + " " + storage[address][key])).val

            for (const key of keys) {
                await storageDB.put(key, storage[address][key])
            }

            await storageDB.close()
        }

        for (const account of Object.keys(states)) {
            await stateDB.put(account, states[account])

            await codeDB.put(states[account].codeHash, code[states[account].codeHash])
        }

        return true
    }

    static async hasValidTxOrder(block, stateDB) {
        const nonces = {}

        for (const tx of block.transactions) {
            const txSenderPubkey = Transaction.getPubKey(tx)
            const txSenderAddress = SHA256(txSenderPubkey)

            if (typeof nonces[txSenderAddress] === "undefined") {
                const senderState = await stateDB.get(txSenderAddress)

                nonces[txSenderAddress] = senderState.nonce
            }

            if (nonces[txSenderAddress] + 1 !== tx.nonce) return false

            nonces[txSenderAddress]++
        }

        return true
    }

    static hasValidGasLimit(block) {
        let totalGas = 0n

        for (const tx of block.transactions) {
            totalGas += BigInt(tx.additionalData.contractGas || 0)
        }

        return totalGas <= BigInt(BLOCK_GAS_LIMIT)
    }
}

module.exports = Block
