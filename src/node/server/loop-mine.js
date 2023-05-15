const { BLOCK_TIME } = require("../../config.json")

export const loopMine = (publicKey, ENABLE_CHAIN_REQUEST, ENABLE_LOGGING, chainInfo) => {
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