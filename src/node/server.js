"use strict"

const WS = require("ws")
const { Level } = require('level')
const { fork } = require("child_process")
const { BLOCK_GAS_LIMIT, EMPTY_HASH } = require("../config.json")
const genesisBlock = require("../core/genesis")
const rpc = require("../rpc/rpc")
const TYPE = require("./message-types")
const { parseJSON } = require("../utils/utils")
let { opened , conn, connNodes, mined } = require("../config.json")
let worker = fork(`${__dirname}/../miner/worker.js`) // Worker thread (for PoW mining).
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
/**
 * Isolated server dependencies
*/
const connect = require("./server/connect")
const sendTx = require("./server/send-tx")
const chainRequest = require("./server/chain-request")
const loopMine = require("./server/loop-mine")
const wallet = require("./server/wallet")
const miningNode = require("./server/mining-node")


// Message type cases 
const newBlock = require("./types/new-block")
const reqBlock = require("./types/req-block")
const handshake = require("./types/handshake")
const sendBlock = require("./types/send-block")
const createTx = require("./types/create-tx")

// Starts a Drisseum node at a specified WS address.

const server = async (config, fastify) => {
    const { 
        PORT = 3000, RPC_PORT = 5000, 
        PEERS = [], MAX_PEERS = 3, 
        MY_ADDRESS = "ws://localhost:3000", 
        ENABLE_MINING = false, ENABLE_LOGGING = false, 
        ENABLE_RPC = false, PRIVATE_KEY = null, 
        ENABLE_CHAIN_REQUEST = false 
    } = config

    const { pK , keyPair } = wallet(PRIVATE_KEY)
    process.on("uncaughtException", err => fastify.log.error(err))
    await codeDB.put(EMPTY_HASH, "")
    const server = new WS.Server({ port: PORT })
    fastify.log.info(`WS server started on PORT ${PORT.toString()}`)
    let res = null
    server.on("connection", async (socket, req) => {
        socket.on("message", async _msg => {
            const msg = parseJSON(_msg)
            
            switch (msg.type) {
                case TYPE.NEW_BLOCK:
                    res = await newBlock( msg, chainInfo, currentSyncBlock, stateDB, codeDB, blockDB, bhashDB, 
                        ENABLE_CHAIN_REQUEST, ENABLE_MINING, mined, opened, worker, fastify)
                    opened = res.opened
                    currentSyncBlock = res.currentSyncBlock
                    mined = res.mined
                    break
                case TYPE.CREATE_TRANSACTION:
                    if (!ENABLE_CHAIN_REQUEST){
                        res = await createTx(msg, stateDB, chainInfo, fastify)
                    }
                    break
                case TYPE.REQUEST_BLOCK:
                    if (!ENABLE_CHAIN_REQUEST) {
                        res = await reqBlock(msg, opened, blockDB, fastify)
                        opened = res.opened
                    }
                    break
                case TYPE.SEND_BLOCK:
                    res = await sendBlock(msg, currentSyncBlock, chainInfo,stateDB, codeDB, blockDB, bhashDB, 
                        opened, MY_ADDRESS, ENABLE_CHAIN_REQUEST, fastify)
                    opened = res.opened
                    currentSyncBlock = res.currentSyncBlock
                    break
                case TYPE.HANDSHAKE:
                    res = handshake(msg, MAX_PEERS, MY_ADDRESS, conn, opened, connNodes, fastify)
                    conn = res.conn
                    opened = res.opened
                    connNodes = res.connNodes
            }
        })
    })

    if (!ENABLE_CHAIN_REQUEST) {
        await miningNode(blockDB, stateDB, bhashDB, codeDB, chainInfo)
    }

    PEERS.forEach(peer => {
       res = connect(MY_ADDRESS, peer, conn, opened, connNodes, fastify)
       conn = res.conn
       opened = res.opened
       connNodes = res.connNodes
    })

    let currentSyncBlock = 1
    if (ENABLE_CHAIN_REQUEST) {
        res = await chainRequest(blockDB, currentSyncBlock, stateDB, opened, MY_ADDRESS, fastify)
        opened = res.opened
        currentSyncBlock = res.currentSyncBlock
    }

    if (ENABLE_MINING) {
        res = loopMine(pK, BLOCK_GAS_LIMIT,EMPTY_HASH, stateDB, blockDB, bhashDB, codeDB, chainInfo, 
            worker, mined, opened, ENABLE_CHAIN_REQUEST, fastify)
        mined = res.mined
        opened = res.opened
    }

    if (ENABLE_RPC){
        const _sendTx = tx => sendTx(tx, opened, chainInfo, stateDB, fastify)
        const main = rpc(RPC_PORT, {pK, mining: ENABLE_MINING}, _sendTx, keyPair, stateDB, blockDB, bhashDB, codeDB)
        main()
    }
}

module.exports = {server}
