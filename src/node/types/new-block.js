const { verifyBlock, updateDifficulty } = require("../../consensus/consensus")
const { clearDepreciatedTxns } = require("../../core/txPool")
const { sendMsg } = require("../message")

const newBlock = async (msg, chainInfo, currentSyncBlock, stateDB, 
    codeDB, blockDB, bhashDB,ENABLE_CHAIN_REQUEST, ENABLE_MINING, mined, opened, worker, fastify) => {
        
    const nB = msg.data
    if (!chainInfo.checkedBlock[nB.hash]) { chainInfo.checkedBlock[nB.hash] = true }
    else { return }
    if (!ENABLE_MINING){ fastify.log.info("NEW_BLOCK* from peer. Verifying...") }

    if (nB.parentHash !== chainInfo.latestBlock.parentHash && 
        (!ENABLE_CHAIN_REQUEST || (ENABLE_CHAIN_REQUEST && currentSyncBlock > 1))) {

        chainInfo.checkedBlock[nB.hash] = true
        if (await verifyBlock(nB, chainInfo, stateDB, codeDB)) {
            fastify.log.info("Block verified. Syncing to the chain...")
            if (ENABLE_MINING) {
                mined = true //check their chain length & sync if > your chain else mine
                // worker.kill()
                // worker = fork(`${__dirname}/../../miner/worker.js`)
            }
            await updateDifficulty(nB, chainInfo, blockDB)
            await blockDB.put(nB.blockNumber.toString(), nB)
            await bhashDB.put(nB.hash, nB.blockNumber.toString())
            chainInfo.latestBlock = nB
            chainInfo.txPool = await clearDepreciatedTxns(chainInfo, stateDB)
            fastify.log.info(`Synced at height #${nB.blockNumber}, chain state transited.`)
            sendMsg(message, opened)
            // if (ENABLE_CHAIN_REQUEST) //they perhaps just sent the latest block
            // {
            //     ENABLE_CHAIN_REQUEST = false
            // }
        }
    }
    
}

module.exports = newBlock