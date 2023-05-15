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
