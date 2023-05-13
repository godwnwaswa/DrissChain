"use strict"

const { Level } = require('level')
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const EC = require("elliptic").ec, ec = new EC("secp256k1")

const Transaction = require("./transaction")
const { buildMerkleTree } = require("./merkle")
const { BLOCK_REWARD, BLOCK_GAS_LIMIT, EMPTY_HASH } = require("../config.json")
const drisscript = require("./runtime")
const { indexTxns } = require("../utils/utils")
const { default: fastify } = require('fastify')

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
     * Verifies transactions in the block and transists the state.
     * */
    static async verifyTxAndTransit(block, stateDB, codeDB, enableLogging = false) {
        for (const tx of block.transactions) {
            const {valid, msg} = await Transaction.isValid(tx, stateDB)
            
            if (!valid) {
                fastify.log.error(msg)
                return false
            } else {fastify.log.log(msg)}
        }

        // Get all existing addresses
        const blockAddresses = block.transactions.map(tx => SHA256(Transaction.getPubKey(tx))) //senders' addresses
        const storedAddresses = await stateDB.keys().all()

        // If any sender's address doesn't exist, return false
        if (!blockAddresses.every(address => storedAddresses.includes(address))) return false

        // Start state replay to check if transactions are legit
        let states = {}, code = {}, storage = {}

        for (const tx of block.transactions) {
            const txSenderPubKey = Transaction.getPubKey(tx)
            const txSenderAddress = SHA256(txSenderPubKey)

            //1st tx from this sender address
            if (!states[txSenderAddress]) {
                const senderState = await stateDB.get(txSenderAddress)
                //new entry into the states object of the block; indicates 1st tx from this sender's address
                states[txSenderAddress] = senderState
                //for txns to EOA; there's just a single entry in code object
                code[senderState.codeHash] = await codeDB.get(senderState.codeHash)
                if (senderState.codeHash !== EMPTY_HASH) return false
                states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
            } else {
                //the sender's address has signed multiple txns in the block
                //the codeHash needs to be equal to EMPTY_HASH for a valid txn
                if (states[txSenderAddress].codeHash !== EMPTY_HASH) return false
                //update the state
                states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
            }
            /**
             * Contract deployment
             * 
             * Every state object has its codeHash prop set to EMPTY_HASH, what actually triggers a smart contract is if the tx's 
             * additionalData object has its property `scBody` set! 
            */
            if (states[txSenderAddress].codeHash === EMPTY_HASH && typeof tx.additionalData.scBody === "string") {
                states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
                code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
            }

            // Update nonce
            states[txSenderAddress].nonce += 1 //?for tx ordering
            if (BigInt(states[txSenderAddress].balance) < 0n) return false
            /**
             * If the recipient's address is not in the global state, instantiate it with the default state object.
             * ?should be a valid address
             * The recipient's address has not sent any of the txns in this block yet.
            */
            if (!storedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
                // create an entry in the current block's `states` object.
                states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
                code[EMPTY_HASH] = "" //surely EMPTY_HASH is insanely updated, reasonably for all state objects.
            }
            /**
             * Recipient's address is in the global state; but has not sent any of the txns in this block yet.
            */
            if (storedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
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
        } //end of replay

        // Reward

        if (!storedAddresses.includes(block.coinbase) && !states[block.coinbase]) {
            states[block.coinbase] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
            code[EMPTY_HASH] = ""
        }
        if (storedAddresses.includes(block.coinbase) && !states[block.coinbase]) {
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
        const nonces = {};
        for (const tx of block.transactions) {
            const txSenderAddress = SHA256(Transaction.getPubKey(tx));
            if (!nonces[txSenderAddress]) {
                nonces[txSenderAddress] = (await stateDB.get(txSenderAddress)).nonce;
            }
            if (++nonces[txSenderAddress] !== tx.nonce) return false;
        }
        return true;
    }

    static hasValidGasLimit(block) {
        const totalGas = block.transactions.reduce((acc, tx) =>
            acc + BigInt(tx.additionalData.contractGas || 0), 0n);
        return totalGas <= BigInt(BLOCK_GAS_LIMIT);
    }
}

module.exports = Block
