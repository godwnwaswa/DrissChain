"use strict"

const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const WS = require("ws")
const EC = require("elliptic").ec, ec = new EC("secp256k1")
const { Level } = require('level')
const { fork } = require("child_process")

const Block = require("../core/block")
const Transaction = require("../core/transaction")
const changeState = require("../core/state")
const { 
    BLOCK_REWARD, 
    BLOCK_GAS_LIMIT, 
    EMPTY_HASH, 
    INITIAL_SUPPLY, 
    FIRST_ACCOUNT, 
    BLOCK_TIME } = require("../config.json")

const { produceMsg, sendMsg } = require("./message")
const genesisBlock = require("../core/genesis")
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
    latestBlock: genesisBlock(),
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
 * Isolated dependencies
*/

const {connect} = require("./server/connect")
const {sendTx} = require("./server/send-tx")
const {chainRequest} = require("./server/chain-request")
const {loopMine} = require("./server/loop-mine")

//types
const {newBlock} = require("./types/new-block")
const {requestBlock} = require("./types/req-block")
const {handshake} = require("./types/handshake")
const {sendBlock} = require("./types/send-block")
const {createTx} = require("./types/create-tx")


/**
 * Starts a Drisseum node at a specified WS address.
 * */
const server = async config => {
    const { 
        PORT = 3000, RPC_PORT = 5000, 
        PEERS = [], MAX_PEERS = 10, 
        MY_ADDRESS = "ws://localhost:3000", 
        ENABLE_MINING = false, ENABLE_LOGGING = false, 
        ENABLE_RPC = false, PRIVATE_KEY = null, 
        ENABLE_CHAIN_REQUEST = false 
    } = config

    const privateKey = PRIVATE_KEY 
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

    PEERS.forEach(peer => connect(MY_ADDRESS, peer, connected, opened, connectedNodes, fastify))
    let currentSyncBlock = 1
    if (ENABLE_CHAIN_REQUEST) {
        chainRequest(blockDB, currentSyncBlock, stateDB, opened, MY_ADDRESS)
    }

    if (ENABLE_MINING) loopMine(
        publicKey, 
        ENABLE_CHAIN_REQUEST, 
        ENABLE_LOGGING, 
        chainInfo)

    if (ENABLE_RPC){
        const main = rpc(
            RPC_PORT, 
            { publicKey, mining: ENABLE_MINING }, 
            sendTx, keyPair, stateDB, blockDB, bhashDB, codeDB)
        main()
    }
    
}

module.exports = { server }
