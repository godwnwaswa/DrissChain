const drisscript = require("./../runtime")
const { genMTree } = require("./../merkle")
const { Level } = require('level')

const exeContract = async (tx, nB, stateDB, codeDB, senderState) => {
    const contractInfo = { address: tx.recipient }
    const [ newState, newStorage ] = await drisscript(await codeDB.get(senderState.codeHash), {}, 
    BigInt(tx.additionalData.contractGas || 0), stateDB, nB, tx, contractInfo)

    const storageDB = new Level(__dirname + "/../log/accountStore/" + tx.recipient)
    const keys = Object.keys(newStorage)
    newState[tx.recipient].storageRoot = genMTree(keys.map(key => key + " " + newStorage[key])).val
    for (const key in newStorage) { await storageDB.put(key, newStorage[key]) }
    await storageDB.close()
    for (const account of Object.keys(newState)) { await stateDB.put(account, newState[account]) }
    await stateDB.close()
}

module.exports = exeContract