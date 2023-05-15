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

const Transaction = require("../../core/transaction")
const { sendMsg } = require("../message")

export const createTx = async (msg, stateDB, chainInfo) => {
    const tx = msg.data
    const {valid, msg} = await Transaction.isValid(tx, stateDB)
    
    if (!valid) {
        fastify.log.error(msg)
        return
    } else{ fastify.log.info(msg)}

    const txSenderPubkey = Transaction.getPubKey(tx)
    const txSenderAddress = SHA256(txSenderPubkey)
    if (!(await stateDB.keys().all()).includes(txSenderAddress)) return

    let maxNonce = 0
    for (const _tx of chainInfo.txPool) {
        const poolTxSenderPubkey = Transaction.getPubKey(_tx)
        const poolTxSenderAddress = SHA256(poolTxSenderPubkey)
        if (poolTxSenderAddress === txSenderAddress && _tx.nonce > maxNonce) {
            maxNonce = tx.nonce
        }
    }
    if (maxNonce + 1 !== tx.nonce) return
    fastify.log.info("New tx received, broadcasted and added to pool.")
    chainInfo.txPool.push(tx)
    sendMsg(message, opened)
    
}