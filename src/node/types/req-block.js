const TYPE = require("../message-types")
const { prodMsg } = require("../message")

const reqBlock = async (msg, opened, blockDB, fastify) => {
    const res = { opened }
    const { blockNumber, requestAddress } = msg.data
    const socket = res.opened.find(node => node.address === requestAddress).socket
    const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)))
    if (blockNumber > 0 && blockNumber <= currentBlockNumber) {
        const block = await blockDB.get(blockNumber.toString())
        socket.send(prodMsg(TYPE.SEND_BLOCK, block))
        fastify.log.info(`SEND_BLOCK* at height #${blockNumber} to ${requestAddress}.`)
    }
    return res
}

module.exports = reqBlock