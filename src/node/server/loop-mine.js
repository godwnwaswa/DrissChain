const { BLOCK_TIME } = require("../../config.json")
const mine = require('./mine')
/**
 * Node mines non-stop
*/
const loopMine = (pK, BLOCK_GAS_LIMIT, EMPTY_HASH, stateDB, blockDB, bhashDB, codeDB, chainInfo, worker, mined, opened, 
    ENABLE_CHAIN_REQUEST, fastify) => {
    const res = { mined, opened}
    let length = chainInfo.latestBlock.blockNumber
    let mining = true
    setInterval(async () => { 
        if (mining || length !== chainInfo.latestBlock.blockNumber) {
            mining = false
            length = chainInfo.latestBlock.blockNumber
            if (!ENABLE_CHAIN_REQUEST){
                const _res = await mine(pK, BLOCK_GAS_LIMIT,EMPTY_HASH, stateDB, blockDB, bhashDB, codeDB, chainInfo, worker, 
                    res.mined, res.opened, fastify)
            }
        }
    }, BLOCK_TIME)

    return res
}

module.exports = loopMine