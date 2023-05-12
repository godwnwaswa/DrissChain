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
    fastify.log.info("One tx received on the blockchain.")
    fastify.log.info(tx)
    // Transactions are weakly verified when added to the pool (does no state checking), but will be fully checked in block production.
    if (!(await Transaction.isValid(tx, stateDB)) || BigInt(tx.additionalData.contractGas || 0) > BigInt(BLOCK_GAS_LIMIT)) {
        fastify.log.info("Failed to add one tx to pool. Tx invalid.")
        return
    }

    const { transactionPool: txPool} = chainInfo
    // Get public key and address from sender
    const txSenderPubkey = Transaction.getPubKey(tx)
    const txSenderAddress = SHA256(txSenderPubkey)

    if (!(await stateDB.keys().all()).includes(txSenderAddress)) {
        fastify.log.info("Failed to add one tx to pool. Sender address non-existent.")
        return
    }

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
        fastify.log.info("Failed to add 1 tx to pool. Invalid nonce.")
        return
    }
    txPool.push(tx)
    fastify.log.info("Successfully added one tx to pool.")
}

async function clearDepreciatedTxns(chainInfo, stateDB) {
    const txPool = chainInfo.transactionPool
    const newTxPool = [], skipped = {}, maxNonce = {}

    for (const tx of txPool) {
        const txSenderPubkey = Transaction.getPubKey(tx)
        const txSenderAddress = SHA256(txSenderPubkey)
        if (skipped[txSenderAddress]) continue
        const senderState = await stateDB.get(txSenderAddress)
        if (!maxNonce[txSenderAddress]) {
            maxNonce[txSenderAddress] = senderState.nonce
        }
        // Weak-checking
        if (Transaction.isValid(tx, stateDB) && tx.nonce - 1 === maxNonce[txSenderAddress]) {
            newTxPool.push(tx)
            maxNonce[txSenderAddress] = tx.nonce
        }
    }
    return newTxPool
}

module.exports = { addTx, clearDepreciatedTxns }
