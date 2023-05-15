/**
 * Broadcasts a transaction to other nodes.
*/
const sendTx = async tx => {
    fastify.log.info("Tx received on Drisseum.")
    sendMsg(produceMsg(TYPE.CREATE_TRANSACTION, tx), opened)
    const res = await addTx(tx, chainInfo, stateDB)
    if(!res.error){
        fastify.log.info(res.msg)
    } else {fastify.log.error(res.msg)}
}