const { prodMsg } = require("../message")
const { verifyBlock, updateDifficulty } = require("../../consensus/consensus")
const changeState = require("../../core/state")
const TYPE = require("../message-types")

const sendBlock = async (msg, currentSyncBlock, chainInfo, stateDB, codeDB, blockDB, bhashDB, opened, 
    MY_ADDRESS, ENABLE_CHAIN_REQUEST, fastify) => {
    const B = msg.data
    if (ENABLE_CHAIN_REQUEST && currentSyncBlock === B.blockNumber) {
        fastify.log.info("REQUEST_BLOCK* from peer. Verifying...")
        if (chainInfo.latestSyncBlock === null || await verifyBlock(B, chainInfo, stateDB, codeDB)) {
            fastify.log.info("Block verified. Syncing to the chain...")
            currentSyncBlock += 1
            await blockDB.put(B.blockNumber.toString(), B)
            await bhashDB.put(B.hash, B.blockNumber.toString())
            if (!chainInfo.latestSyncBlock) {
                chainInfo.latestSyncBlock = B
                await changeState(B, stateDB, codeDB)
            }
            chainInfo.latestBlock = B
            await updateDifficulty(B, chainInfo, blockDB)
            fastify.log.info(`Synced at height #${B.blockNumber}, chain state transited.`)

            for (const node of opened) {
                node.socket.send(prodMsg(TYPE.REQUEST_BLOCK, { blockNumber: currentSyncBlock, requestAddress: MY_ADDRESS }))
                await new Promise(r => setTimeout(r, 5000))
            }
        }
    }
    return  { opened, currentSyncBlock, chainInfo }
}

module.exports = sendBlock