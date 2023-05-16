const { BLOCK_TIME } = require("../../config.json")
const mine = require('./mine')

const loopMine = (publicKey, BLOCK_GAS_LIMIT,EMPTY_HASH, stateDB, 
    blockDB, bhashDB, codeDB, chainInfo, 
    worker, mined, opened, ENABLE_CHAIN_REQUEST, fastify, fork) => {

    let length = chainInfo.latestBlock.blockNumber
    let mining = true
    setInterval(async () => {
        if (mining || length !== chainInfo.latestBlock.blockNumber) {
            mining = false
            length = chainInfo.latestBlock.blockNumber
            if (!ENABLE_CHAIN_REQUEST) await mine(
                publicKey, BLOCK_GAS_LIMIT,EMPTY_HASH, stateDB, 
                blockDB, bhashDB, codeDB, chainInfo, 
                worker, mined, opened, fastify, fork)
        }
    }, BLOCK_TIME)
}

module.exports = loopMine