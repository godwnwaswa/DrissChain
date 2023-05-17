const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const Transaction = require("../../core/transaction")
const { sendMsg } = require("../message")

const createTx = async (_msg, stateDB, chainInfo, fastify) => {
    const tx = _msg.data
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
    return { chainInfo }
}

module.exports = createTx