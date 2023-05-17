const changeState = require("../../core/state")
const { EMPTY_HASH, INITIAL_SUPPLY, FIRST_ACCOUNT } = require("../../config.json")

const miningNode = async (blockDB, stateDB, bhashDB, codeDB, chainInfo) => {
  if ((await blockDB.keys().all()).length === 0) {
    await stateDB.put(FIRST_ACCOUNT, { balance: INITIAL_SUPPLY, codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH })
    await blockDB.put(chainInfo.latestBlock.blockNumber.toString(), chainInfo.latestBlock)
    await bhashDB.put(chainInfo.latestBlock.hash, chainInfo.latestBlock.blockNumber.toString())
    await changeState(chainInfo.latestBlock, stateDB, codeDB)
  } else {
    chainInfo.latestBlock = await blockDB.get(Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))).toString())
    chainInfo.difficulty = chainInfo.latestBlock.difficulty
  }
}


module.exports = miningNode