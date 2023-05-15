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
const mine = require('./mine')

const loopMine = (publicKey, BLOCK_GAS_LIMIT, stateDB, 
    blockDB, bhashDB, codeDB, chainInfo, 
    worker, mined, ENABLE_CHAIN_REQUEST) => {

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

module.exports = loopMine