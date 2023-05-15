export const createTx = async (_message) => {
    if (ENABLE_CHAIN_REQUEST) break
    const transaction = _message.data
    const {valid, msg} = await Transaction.isValid(transaction, stateDB)
    
    if (!valid) {
        fastify.log.error(msg)
        break
    } else{ fastify.log.info(msg)}

    const txSenderPubkey = Transaction.getPubKey(transaction)
    const txSenderAddress = SHA256(txSenderPubkey)
    if (!(await stateDB.keys().all()).includes(txSenderAddress)) break

    let maxNonce = 0
    for (const tx of chainInfo.txPool) {
        const poolTxSenderPubkey = Transaction.getPubKey(transaction)
        const poolTxSenderAddress = SHA256(poolTxSenderPubkey)
        if (poolTxSenderAddress === txSenderAddress && tx.nonce > maxNonce) {
            maxNonce = tx.nonce
        }
    }
    if (maxNonce + 1 !== transaction.nonce) return
    fastify.log.info("New transaction received, broadcasted and added to pool.")
    chainInfo.txPool.push(transaction)
    sendMsg(message, opened)
    
}