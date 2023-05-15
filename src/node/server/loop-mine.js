const { BLOCK_TIME } = require("../../config.json")

export const loopMine = (publicKey, chainInfo, stateDB, BLOCK_GAS_LIMIT, ENABLE_CHAIN_REQUEST, ENABLE_LOGGING) => {
    let length = chainInfo.latestBlock.blockNumber
    let mining = true

    setInterval(async () => {
        if (mining || length !== chainInfo.latestBlock.blockNumber) {
            mining = false
            length = chainInfo.latestBlock.blockNumber
            if (!ENABLE_CHAIN_REQUEST) await mine(publicKey, BLOCK_GAS_LIMIT, stateDB, chainInfo, worker)
        }
    }, BLOCK_TIME)
}