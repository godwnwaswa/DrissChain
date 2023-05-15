const pino = require('pino')
const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            ignore: 'pid,hostname',
        },
    },
})
const fastify = require('fastify')({
    logger: logger
})

const { produceMsg, sendMsg } = require("../message")
const TYPE = require("../message-types")

/**
 * Broadcasts a transaction to other nodes.
*/
const sendTx = async (tx, opened, chainInfo, stateDB) => {
    fastify.log.info("Tx received on Drisseum.")
    sendMsg(produceMsg(TYPE.CREATE_TRANSACTION, tx), opened)
    const res = await addTx(tx, chainInfo, stateDB)
    if(!res.error){
        fastify.log.info(res.msg)
    } else {fastify.log.error(res.msg)}
}

module.exports = sendTx