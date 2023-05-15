"use strict"

const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const WS = require("ws")
const EC = require("elliptic").ec, ec = new EC("secp256k1")
const { Level } = require('level')
const { fork } = require("child_process")

const Block = require("../core/block")
const Transaction = require("../core/transaction")
const changeState = require("../core/state")
const { BLOCK_REWARD, BLOCK_GAS_LIMIT, EMPTY_HASH, INITIAL_SUPPLY, FIRST_ACCOUNT, BLOCK_TIME } = require("../config.json")
const { produceMsg, sendMsg } = require("./message")
const generateGenesisBlock = require("../core/genesis")
const { addTx, clearDepreciatedTxns } = require("../core/txPool")
const rpc = require("../rpc/rpc")
const TYPE = require("./message-types")
const { verifyBlock, updateDifficulty } = require("../consensus/consensus")
const { parseJSON, indexTxns } = require("../utils/utils")
const drisscript = require("../core/runtime")
const { buildMerkleTree } = require("../core/merkle")

const opened = []  // Addresses and sockets from connected nodes.
const connected = []  // Addresses from connected nodes.
let connectedNodes = 0

let worker = fork(`${__dirname}/../miner/worker.js`) // Worker thread (for PoW mining).
let mined = false // This will be used to inform the node that another node has already mined before it.


// Some chain info cache
const chainInfo = {
    txPool: [],
    latestBlock: generateGenesisBlock(),
    latestSyncBlock: null,
    checkedBlock: {},
    tempStates: {},
    difficulty: 1
}

const stateDB = new Level(__dirname + "/../log/stateStore", { valueEncoding: "json" })
const blockDB = new Level(__dirname + "/../log/blockStore", { valueEncoding: "json" })
const bhashDB = new Level(__dirname + "/../log/bhashStore")
const codeDB = new Level(__dirname + "/../log/codeStore")

const pino = require('pino')
const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            ignore: 'pid,hostname',
        },
    },
})
const fastify = require('fastify')({
    logger: logger
})
/**
 * Starts a Drissium node at a specified WS address.
 * */
const startServer = async options => {
    const { 
        PORT = 3000, RPC_PORT = 5000, 
        PEERS = [], MAX_PEERS = 10, 
        MY_ADDRESS = "ws://localhost:3000", 
        ENABLE_MINING = false, ENABLE_LOGGING = false, 
        ENABLE_RPC = false, PRIVATE_KEY = null, 
        ENABLE_CHAIN_REQUEST = false 
    } = options
    const privateKey = PRIVATE_KEY || ec.genKeyPair().getPrivate("hex")
    const keyPair = ec.keyFromPrivate(privateKey, "hex")
    const publicKey = keyPair.getPublic("hex")
    process.on("uncaughtException", err => fastify.log.error(err))
    await codeDB.put(EMPTY_HASH, "")
    const server = new WS.Server({ port: PORT })
    fastify.log.info(`WS server started on PORT ${PORT.toString()}`)
    server.on("connection", async (socket, req) => {
        /**
         * The message handler
         * */
        socket.on("message", async message => {
            const _message = parseJSON(message)
            switch (_message.type) {
                case TYPE.NEW_BLOCK:
                    newBlock(_message)
                    break

                case TYPE.CREATE_TRANSACTION:
                    createTx(_message)
                    break

                case TYPE.REQUEST_BLOCK:
                    requestBlock(_message)
                    break

                case TYPE.SEND_BLOCK:
                    sendBlock(_message)
                    break

                case TYPE.HANDSHAKE:
                    handshake(_message)
            }
        })
    })

    if (!ENABLE_CHAIN_REQUEST) {
        if ((await blockDB.keys().all()).length === 0) {
            await stateDB.put(FIRST_ACCOUNT, { balance: INITIAL_SUPPLY, codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH })
            await blockDB.put(chainInfo.latestBlock.blockNumber.toString(), chainInfo.latestBlock)
            await bhashDB.put(chainInfo.latestBlock.hash, chainInfo.latestBlock.blockNumber.toString())
            await changeState(chainInfo.latestBlock, stateDB, codeDB)
        } else {
            chainInfo.latestBlock = await blockDB.get(Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))).toString())
            chainInfo.difficulty = chainInfo.latestBlock.difficulty
        }
    }

    PEERS.forEach(peer => connect(MY_ADDRESS, peer))
    let currentSyncBlock = 1
    if (ENABLE_CHAIN_REQUEST) {
        const blockNumbers = await blockDB.keys().all()
        if (blockNumbers.length !== 0) {
            currentSyncBlock = Math.max(...blockNumbers.map(key => parseInt(key)))
        }
        if (currentSyncBlock === 1) {
            await stateDB.put(FIRST_ACCOUNT, { 
                balance: INITIAL_SUPPLY, 
                codeHash: EMPTY_HASH, 
                nonce: 0, 
                storageRoot: EMPTY_HASH 
            })
        }
        setTimeout(async () => {
            for (const node of opened) {
                node.socket.send(produceMsg(TYPE.REQUEST_BLOCK, { 
                    blockNumber: currentSyncBlock, 
                    requestAddress: MY_ADDRESS 
                }))
                await new Promise(r => setTimeout(r, 5000))
            }
        }, 5000)
    }

    if (ENABLE_MINING) loopMine(publicKey, ENABLE_CHAIN_REQUEST, ENABLE_LOGGING, BLOCK_TIME)
    if (ENABLE_RPC){
        const main = rpc(RPC_PORT, { publicKey, mining: ENABLE_MINING }, sendTx, keyPair, stateDB, blockDB, bhashDB, codeDB)
        main()
    }
    
}
/**
 * Connects to a WS server at the specified address.
 * */
const connect = (MY_ADDRESS, address) => {
    /**
     * Check if the `address` is not already in the `connected` array and if it is not equal to `MY_ADDRESS`.
     * */
    if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
        const socket = new WS(address)
        /**
         * Open a connection to the socket and send a handshake message to all connected nodes.
         * */
        socket.on("open", async () => {
            for (const _address of [MY_ADDRESS, ...connected]) socket.send(produceMsg(TYPE.HANDSHAKE, _address))
            for (const node of opened) node.socket.send(produceMsg(TYPE.HANDSHAKE, address))

            if (!opened.find(peer => peer.address === address) && address !== MY_ADDRESS) {
                opened.push({ socket, address })
            }
            if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
                connected.push(address)
                connectedNodes++
                fastify.log.info(`Connected to ${address}.`)
                socket.on("close", () => {
                    opened.splice(connected.indexOf(address), 1)
                    fastify.log.info(`Disconnected from ${address}.`)
                })
            }
        })
    }
    return true
}
/**
 * Broadcasts a transaction to other nodes.
*/
const sendTx = async tx => {
    fastify.log.info("Tx received on Drisseum.")
    sendMsg(produceMsg(TYPE.CREATE_TRANSACTION, tx), opened)
    const res = await addTx(tx, chainInfo, stateDB)
    if(!res.error){
        fastify.log.info(res.msg)
    } else {fastify.log.error(res.msg)}
}

const mine = async (publicKey, ENABLE_LOGGING) => {

    const mine = (block, difficulty) => {
        return new Promise((resolve, reject) => {
            worker.addListener("message", message => resolve(message.result))
            worker.send({ type: "MINE", data: [block, difficulty] })
        })
    }

    // Create a new block.
    const block = new Block(chainInfo.latestBlock.blockNumber + 1, Date.now(), [],chainInfo.difficulty, chainInfo.latestBlock.hash, SHA256(publicKey))
    // Collect a list of transactions to mine
    const transactionsToMine = [], states = {}, code = {}, storage = {}, skipped = {}
    let totalContractGas = 0n, totalTxGas = 0n
    const existedAddresses = await stateDB.keys().all()
    for (const tx of chainInfo.txPool) {
        if (totalContractGas + BigInt(tx.additionalData.contractGas || 0) >= BigInt(BLOCK_GAS_LIMIT)) break
        const txSenderPubkey = Transaction.getPubKey(tx)
        const txSenderAddress = SHA256(txSenderPubkey)
        if (skipped[txSenderAddress]) continue // Check if transaction is from an ignored address.
        // Normal coin transfers
        if (!states[txSenderAddress]) {
            const senderState = await stateDB.get(txSenderAddress)
            states[txSenderAddress] = senderState
            code[senderState.codeHash] = await codeDB.get(senderState.codeHash)
            if (senderState.codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true
                continue
            }
            states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
        } else {
            if (states[txSenderAddress].codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true
                continue
            }
            states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
        }
        if (!existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
            code[EMPTY_HASH] = ""
        }
        if (existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = await stateDB.get(tx.recipient)
            code[states[tx.recipient].codeHash] = await codeDB.get(states[tx.recipient].codeHash)
        }
        states[tx.recipient].balance = (BigInt(states[tx.recipient].balance) + BigInt(tx.amount)).toString()
        // Contract deployment
        if (states[txSenderAddress].codeHash === EMPTY_HASH && typeof tx.additionalData.scBody === "string" ) {
            states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
            code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
        }
        // Update nonce
        states[txSenderAddress].nonce += 1
        // Decide to drop or add transaction to block
        if (BigInt(states[txSenderAddress].balance) < 0n) {
            skipped[txSenderAddress] = true
            continue
        } else {
            transactionsToMine.push(tx)
            totalContractGas += BigInt(tx.additionalData.contractGas || 0)
            totalTxGas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0)
        }

        // Contract execution
        if (states[tx.recipient].codeHash !== EMPTY_HASH) {
            const contractInfo = { address: tx.recipient }
            const [newState, newStorage] = await drisscript(code[states[tx.recipient].codeHash], states, BigInt(tx.additionalData.contractGas || 0), stateDB, block, tx, contractInfo, false)
            for (const account of Object.keys(newState)) {
                states[account] = newState[account]
                storage[tx.recipient] = newStorage
            }
        }
    }
    block.transactions = transactionsToMine // Add transactions to block
    block.hash = Block.getHash(block) // Re-hash with new transactions
    block.txRoot = buildMerkleTree(indexTxns(block.transactions)).val // Re-gen transaction root with new transactions
    // Mine the block.
    mine(block, chainInfo.difficulty)
        .then(async result => {
            // If the block is not mined before, we will add it to our chain and broadcast this new block.
            if (!mined) {
                await updateDifficulty(result, chainInfo, blockDB) // Update difficulty
                await blockDB.put(result.blockNumber.toString(), result) // Add block to chain
                await bhashDB.put(result.hash, result.blockNumber.toString()) // Assign block number to the matching block hash
                chainInfo.latestBlock = result // Update chain info
                // Reward
                if (!existedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
                    code[EMPTY_HASH] = ""
                }
                if (existedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = await stateDB.get(result.coinbase)
                    code[states[result.coinbase].codeHash] = await codeDB.get(states[result.coinbase].codeHash)
                }
                let gas = 0n
                for (const tx of result.transactions) { gas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0) }
                states[result.coinbase].balance = (BigInt(states[result.coinbase].balance) + BigInt(BLOCK_REWARD) + gas).toString()
                // Transit state
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
                // Update the new transaction pool (remove all the transactions that are no longer valid).
                chainInfo.txPool = await clearDepreciatedTxns(chainInfo, stateDB)
                sendMsg(produceMsg(TYPE.NEW_BLOCK, chainInfo.latestBlock), opened) // Broadcast the new block
                fastify.log.info(`NEW_BLOCK* mined. Synced at height #${chainInfo.latestBlock.blockNumber}, chain state transited.`)
            } else {
                mined = false
            }
            // Re-create the worker thread
            worker.kill()
            worker = fork(`${__dirname}/../miner/worker.js`)
        })
        .catch(err => fastify.log.error(err))
}

const loopMine = (publicKey, ENABLE_CHAIN_REQUEST, ENABLE_LOGGING, BLOCK_TIME) => {
    let length = chainInfo.latestBlock.blockNumber
    let mining = true

    setInterval(async () => {
        if (mining || length !== chainInfo.latestBlock.blockNumber) {
            mining = false
            length = chainInfo.latestBlock.blockNumber
            if (!ENABLE_CHAIN_REQUEST) await mine(publicKey, ENABLE_LOGGING)
        }
    }, BLOCK_TIME)
}

module.exports = { startServer }
