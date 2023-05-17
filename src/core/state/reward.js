const { BLOCK_REWARD } = require("../../config.json")

const processReward = async (nB, storedAddresses, stateDB) => {
    let gas = 0n
    for (const tx of nB.transactions) { gas += BigInt(tx.gas) + BigInt() + BigInt(tx.additionalData.contractGas || 0) }
    if (!storedAddresses.includes(nB.coinbase)) {
        const stateObj = { 
            balance: (BigInt(BLOCK_REWARD) + gas).toString(), 
            codeHash: EMPTY_HASH, 
            nonce: 0, 
            storageRoot: EMPTY_HASH 
        }

        await stateDB.put(nB.coinbase, stateObj)
    } else {
        const minerState = await stateDB.get(nB.coinbase)
        minerState.balance = (BigInt(minerState.balance) + BigInt(BLOCK_REWARD) + gas).toString()
        await stateDB.put(nB.coinbase, minerState)
    }
}

module.exports = processReward