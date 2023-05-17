const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const Block = require("../../core/block")
const { genMTree } = require("../../core/merkle")
const { indexTxns } = require("../../utils/utils")
const processTx = require('./process-tx')
const work = require('./work')
const { fork } = require("child_process")

/**
 * Mines txns from the txPool
*/
const mine = async ( pK, BLOCK_GAS_LIMIT, EMPTY_HASH, stateDB, blockDB, bhashDB, codeDB, chainInfo, worker, 
    mined, opened, fastify) => {

    const _res = { mined, opened }
    const _work = (block, difficulty, worker) => {
        return new Promise((resolve, reject) => {
            worker.addListener("message", message => resolve(message.result))
            worker.send({ type: "MINE", data: [block, difficulty] })
        })
    }

    // collect txns to mine
    let txnsToMine = [], states = {}, code = {}, storage = {}, skipped = {}
    let tContractGas = 0n, tTxGas = 0n
    const storedAddresses = await stateDB.keys().all()
    // fastify.log.info(`txpool: ${chainInfo.txPool}`)
    for (const tx of chainInfo.txPool) {
        if (tContractGas + BigInt(tx.additionalData.contractGas || 0) >= BigInt(BLOCK_GAS_LIMIT)) break
        const res = await processTx(
            tx, tContractGas, tTxGas,
            txnsToMine, stateDB, codeDB,
            states, code, skipped, storage, storedAddresses, fastify)
        //update inputs 
        // fastify.log.info(res)
        tContractGas = res.tContractGas
        tTxGas = res.tTxGas
        txnsToMine = res.txnsToMine
        states = res.states
        code = res.code
        storage = res.storage
        skipped = res.skipped

    }
    // Create a new block.
    const block = new Block(chainInfo.latestBlock.blockNumber + 1,  Date.now(), [],
    chainInfo.difficulty, chainInfo.latestBlock.hash, SHA256(pK))

    block.transactions = txnsToMine 
    block.hash = Block.getHash(block) 
    block.txRoot = genMTree(indexTxns(block.transactions)).val // Re-gen transaction root with new transactions

    // Mine the block.
    _work(block, chainInfo.difficulty, worker)
        .then(async B => {
            // If the block is not mined before, we will add it to our chain and broadcast this new block.
            if (!_res.mined) {
                await work(B, chainInfo, blockDB, bhashDB, stateDB, 
                    codeDB, storedAddresses, states, code, storage, _res.opened, EMPTY_HASH, fastify)
                return _res // to-do >> build a detailed res object
            }
            _res.mined = false
            // Re-create the worker thread
            worker.kill()
            worker = fork(`${__dirname}/../../miner/worker.js`)
        })
        .catch(err => fastify.log.error(err))
    return _res
}

module.exports = mine