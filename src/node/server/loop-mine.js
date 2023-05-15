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

const { BLOCK_TIME } = require("../../config.json")
const {mine} = require('./mine')

export const loopMine = (
    publicKey, chainInfo, BLOCK_GAS_LIMIT, 
    ENABLE_CHAIN_REQUEST, worker, stateDB, 
    blockDB, bhashDB, codeDB, chainInfo, 
    worker, mined) => {

    let length = chainInfo.latestBlock.blockNumber
    let mining = true
    setInterval(async () => {
        if (mining || length !== chainInfo.latestBlock.blockNumber) {
            mining = false
            length = chainInfo.latestBlock.blockNumber
            if (!ENABLE_CHAIN_REQUEST) await mine(
                publicKey, BLOCK_GAS_LIMIT, stateDB, 
                blockDB, bhashDB, codeDB, chainInfo, 
                worker, mined)
        }
    }, BLOCK_TIME)
}