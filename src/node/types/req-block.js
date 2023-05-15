export const requestBlock = async () => {
    if (!ENABLE_CHAIN_REQUEST) {
        const { blockNumber, requestAddress } = _message.data
        const socket = opened.find(node => node.address === requestAddress).socket
        const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)))
        if (blockNumber > 0 && blockNumber <= currentBlockNumber) {
            const block = await blockDB.get(blockNumber.toString())
            socket.send(produceMsg(TYPE.SEND_BLOCK, block))
            fastify.log.info(`SEND_BLOCK* at height #${blockNumber} to ${requestAddress}.`)
        }
    }

}