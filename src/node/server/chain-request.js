const { EMPTY_HASH, INITIAL_SUPPLY, FIRST_ACCOUNT } = require("../../config.json")

const chainRequest = async (blockDB, currentSyncBlock, stateDB, fastify) => {
    fastify.log.info('hit')
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

    return { currentSyncBlock }
}


module.exports = chainRequest