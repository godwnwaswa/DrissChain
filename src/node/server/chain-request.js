const { 
    EMPTY_HASH, 
    INITIAL_SUPPLY, 
    FIRST_ACCOUNT } = require("../../config.json")

const { produceMsg } = require("../message")
const TYPE = require("../message-types")

const chainRequest = async (blockDB, currentSyncBlock, stateDB, opened, MY_ADDRESS) => {
    const blockNumbers = await blockDB.keys().all()
    if (blockNumbers.length !== 0) {
        currentSyncBlock = Math.max(...blockNumbers.map(key => parseInt(key)))
    }
    if (currentSyncBlock === 1) {
        await stateDB.put(FIRST_ACCOUNT, { 
            balance: INITIAL_SUPPLY, 
            codeHash: EMPTY_HASH, 
            nonce: 0, 
            storageRoot: EMPTY_HASH 
        })
    }
    setTimeout(async () => {
        for (const node of opened) {
            node.socket.send(produceMsg(TYPE.REQUEST_BLOCK, { 
                blockNumber: currentSyncBlock, 
                requestAddress: MY_ADDRESS 
            }))
            await new Promise(r => setTimeout(r, 5000))
        }
    }, 5000)

}


module.exports = chainRequest