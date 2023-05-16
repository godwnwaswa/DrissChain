const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const Block = require("../../core/block")
const { genMTree } = require("../../core/merkle")
const { indexTxns } = require("../../utils/utils")
const { updateDifficulty } = require("../../consensus/consensus")
const execTx = require('./execute-tx')
const { BLOCK_REWARD } = require("../../config.json")
const { clearDepreciatedTxns } = require("../../core/txPool")
const { prodMsg, sendMsg } = require("../message")
const TYPE = require("../message-types")
const { Level } = require('level')

/**
 * Mines txns from the txPool
*/
const mine = async (
    pK, BLOCK_GAS_LIMIT, EMPTY_HASH, stateDB,
    blockDB, bhashDB, codeDB, chainInfo,
    worker, mined, opened, fastify, fork) => {

    const work = (block, difficulty, worker) => {
        return new Promise((resolve, reject) => {
            worker.addListener("message", message => resolve(message.result))
            worker.send({ type: "MINE", data: [block, difficulty] })
        })
    }

    // Create a new block.
    const block = new Block(
        chainInfo.latestBlock.blockNumber + 1,
        Date.now(), [], chainInfo.difficulty,
        chainInfo.latestBlock.hash,
        SHA256(pK))

    // Collect a list of transactions to mine
    let txnsToMine = [], states = {}, code = {}, storage = {}, skipped = {}
    let tContractGas = 0n, tTxGas = 0n
    const storedAddresses = await stateDB.keys().all()
    // fastify.log.info(`txpool: ${chainInfo.txPool}`)
    for (const tx of chainInfo.txPool) {
        if (tContractGas + BigInt(tx.additionalData.contractGas || 0) >= BigInt(BLOCK_GAS_LIMIT)) break
        const res = await execTx(
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



    block.transactions = txnsToMine // Add transactions to block
    block.hash = Block.getHash(block) // Re-hash with new transactions
    block.txRoot = genMTree(indexTxns(block.transactions)).val // Re-gen transaction root with new transactions

    // Mine the block.
    work(block, chainInfo.difficulty, worker)
        .then(async result => {
            // If the block is not mined before, we will add it to our chain and broadcast this new block.
            if (!mined) {
                await updateDifficulty(result, chainInfo, blockDB) // Update difficulty
                await blockDB.put(result.blockNumber.toString(), result) // Add block to chain
                await bhashDB.put(result.hash, result.blockNumber.toString()) // Assign block number to the matching block hash
                chainInfo.latestBlock = result // Update chain info
                // Reward
                if (!storedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
                    code[EMPTY_HASH] = ""
                }
                if (storedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = await stateDB.get(result.coinbase)
                    code[states[result.coinbase].codeHash] = await codeDB.get(states[result.coinbase].codeHash)
                }
                let gas = 0n
                for (const tx of result.transactions) { gas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0) }
                states[result.coinbase].balance = (BigInt(states[result.coinbase].balance) + BigInt(BLOCK_REWARD) + gas).toString()
                // Transit state
                for (const address in storage) {
                    const storageDB = new Level(__dirname + "/../../log/accountStore/" + address)
                    const keys = Object.keys(storage[address])
                    states[address].storageRoot = genMTree(keys.map(key => key + " " + storage[address][key])).val
                    for (const key of keys) {
                        await storageDB.put(key, storage[address][key])
                    }
                    await storageDB.close()
                }

                for (const account of Object.keys(states)) {
                    await stateDB.put(account, states[account])
                    await codeDB.put(states[account].codeHash, code[states[account].codeHash])
                }
                // Update the new transaction pool (remove all the transactions that are no longer valid).
                chainInfo.txPool = await clearDepreciatedTxns(chainInfo, stateDB)
                sendMsg(prodMsg(TYPE.NEW_BLOCK, chainInfo.latestBlock), opened) // Broadcast the new block
                fastify.log.info(`NEW_BLOCK* mined. Synced at height #${chainInfo.latestBlock.blockNumber}, chain state transited.`)
            } else {
                mined = false
            }
            // Re-create the worker thread
            // worker.kill()
            // worker = fork(`${__dirname}/../../miner/worker.js`)
        })
        .catch(err => fastify.log.error(err))
}

module.exports = mine