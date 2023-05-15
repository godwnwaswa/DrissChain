const newBlock = async (_message) => {
    const newBlock = _message.data
    if (!chainInfo.checkedBlock[newBlock.hash]) {
        chainInfo.checkedBlock[newBlock.hash] = true
    }
    else {
        return
    }

    if (!ENABLE_MINING){
        fastify.log.info("NEW_BLOCK* from peer. Verifying...")
    }
    
    if (newBlock.parentHash !== chainInfo.latestBlock.parentHash && (!ENABLE_CHAIN_REQUEST || (ENABLE_CHAIN_REQUEST && currentSyncBlock > 1))) {
        chainInfo.checkedBlock[newBlock.hash] = true
        if (await verifyBlock(newBlock, chainInfo, stateDB, codeDB, ENABLE_LOGGING)) {
            fastify.log.info("Block verified. Syncing to the chain...")
            if (ENABLE_MINING) {
                mined = true //check their chain length & sync if > your chain else mine
                worker.kill()
                worker = fork(`${__dirname}/../miner/worker.js`)
            }
            await updateDifficulty(newBlock, chainInfo, blockDB)
            await blockDB.put(newBlock.blockNumber.toString(), newBlock)
            await bhashDB.put(newBlock.hash, newBlock.blockNumber.toString())
            chainInfo.latestBlock = newBlock
            chainInfo.txPool = await clearDepreciatedTxns(chainInfo, stateDB)
            fastify.log.info(`Synced at height #${newBlock.blockNumber}, chain state transited.`)
            sendMsg(message, opened)
            // if (ENABLE_CHAIN_REQUEST) //they perhaps just sent the latest block
            // {
            //     ENABLE_CHAIN_REQUEST = false
            // }
        }
    }
    
}