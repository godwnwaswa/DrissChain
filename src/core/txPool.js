const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const EC = require("elliptic").ec, ec = new EC("secp256k1")
const Transaction = require("./transaction")
const drisscript = require("./runtime")
const { BLOCK_GAS_LIMIT } = require("../config.json")
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
  logger : logger
})
const addTx = async (tx, chainInfo, stateDB) => {
    const response = {error: true, msg:''}
    // Transactions are weakly verified when added to the pool (no state checking), but will be fully checked in block production.
    const { valid, msg} = await Transaction.isValid(tx, stateDB)
    if (!(valid) || BigInt(tx.additionalData.contractGas || 0) > BigInt(BLOCK_GAS_LIMIT)) {
        response.msg = `${msg}`
        return response
    }

    const txSenderPubkey = Transaction.getPubKey(tx)
    const txSenderAddress = SHA256(txSenderPubkey)

    if (!(await stateDB.keys().all()).includes(txSenderAddress)) {
        response.msg = 'Sender address non-existent.'
        return response
    }

    const { txPool } = chainInfo
    // Check nonce
    let maxNonce = 0
    for (const tx of txPool) {
        const poolTxSenderPubkey = Transaction.getPubKey(tx)
        const poolTxSenderAddress = SHA256(poolTxSenderPubkey)
        if (poolTxSenderAddress === txSenderAddress && tx.nonce > maxNonce) {
            maxNonce = tx.nonce
        }
    }
    if (maxNonce + 1 !== tx.nonce) {
        response.msg = 'Invalid nonce -- txPool'
        return response
    }

    txPool.push(tx)
    response.msg = `Tx added to txPool. ${msg}`
    response.error = false
    return response
}

const clearDepreciatedTxns = async (chainInfo, stateDB) => { 
    const newTxPool = [], skipped = {}, maxNonce = {}
    for (const tx of chainInfo.txPool) {
        const txSenderPubkey = Transaction.getPubKey(tx)
        const txSenderAddress = SHA256(txSenderPubkey)
        if (skipped[txSenderAddress]) continue
        const senderState = await stateDB.get(txSenderAddress)
        if (!maxNonce[txSenderAddress]) {
            maxNonce[txSenderAddress] = senderState.nonce
        }
        // Weak-checking
        const { valid, msg} = await Transaction.isValid(tx, stateDB)
        
        if(tx.nonce - 1 === maxNonce[txSenderAddress]){
            if (valid) {
                newTxPool.push(tx)
                maxNonce[txSenderAddress] = tx.nonce
                //fastify.log.info(msg)
            } 
        }
    }
    return newTxPool
}

module.exports = { addTx, clearDepreciatedTxns }
