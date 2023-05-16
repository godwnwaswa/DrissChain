const { updateDifficulty } = require("../../consensus/consensus")
const { BLOCK_REWARD } = require("../../config.json")
const { clearDepreciatedTxns } = require("../../core/txPool")
const { prodMsg, sendMsg } = require("../message")
const TYPE = require("../message-types")
const { Level } = require('level')

/**
 * @param B block
*/
const work = async (B, chainInfo, blockDB, bhashDB, stateDB, 
  codeDB, storedAddresses, states, code, storage, opened, EMPTY_HASH, fastify) => {
  await updateDifficulty(B, chainInfo, blockDB) // Update difficulty
  await blockDB.put(B.blockNumber.toString(), B) // Add block to chain
  await bhashDB.put(B.hash, B.blockNumber.toString()) // Assign block number to the matching block hash
  chainInfo.latestBlock = B // Update chain info
  // Reward
  if (!storedAddresses.includes(B.coinbase) && !states[B.coinbase]) {
    states[B.coinbase] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
    code[EMPTY_HASH] = ""
  }
  if (storedAddresses.includes(B.coinbase) && !states[B.coinbase]) {
    states[B.coinbase] = await stateDB.get(B.coinbase)
    code[states[B.coinbase].codeHash] = await codeDB.get(states[B.coinbase].codeHash)
  }
  let gas = 0n
  for (const tx of B.transactions) { gas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0) }
  states[B.coinbase].balance = (BigInt(states[B.coinbase].balance) + BigInt(BLOCK_REWARD) + gas).toString()
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
}


module.exports = work