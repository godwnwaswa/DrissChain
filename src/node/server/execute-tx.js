const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const Transaction = require("../../core/transaction")
const drisscript = require("../../core/runtime")
const { EMPTY_HASH } = require("../../config.json")

/**
 * Executes a single tx in the txPool
*/
const execTx = async (
    tx, tContractGas, tTxGas,
    txnsToMine, stateDB, codeDB,
    states, code, skipped, storage, storedAddresses, fastify) => {
    const txSenderPubkey = Transaction.getPubKey(tx)
    const txSenderAddress = SHA256(txSenderPubkey)
    if (skipped[txSenderAddress]) return // Check if transaction is from an ignored address.
    const res = {
        tContractGas: tContractGas,
        tTxGas: tTxGas,
        states: states,
        code: code,
        txnsToMine: txnsToMine,
        storage: storage,
        skipped: skipped
    }

    // Normal coin transfers
    if (!res.states[txSenderAddress]) {
        fastify.log.info('Processsing a normal coin transfer.')
        const senderState = await stateDB.get(txSenderAddress)
        res.states[txSenderAddress] = senderState
        res.code[senderState.codeHash] = await codeDB.get(senderState.codeHash)
        if (senderState.codeHash !== EMPTY_HASH) {
            res.skipped[txSenderAddress] = true
            return res
        }
        res.states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
    } else {
        if (res.states[txSenderAddress].codeHash !== EMPTY_HASH) {
            res.skipped[txSenderAddress] = true
            return res
        }
        res.states[txSenderAddress].balance = (BigInt(res.states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
    }
    if (!storedAddresses.includes(tx.recipient) && !res.states[tx.recipient]) {
        res.states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
        res.code[EMPTY_HASH] = ""
    }
    if (storedAddresses.includes(tx.recipient) && !res.states[tx.recipient]) {
        res.states[tx.recipient] = await stateDB.get(tx.recipient)
        res.code[res.states[tx.recipient].codeHash] = await codeDB.get(res.states[tx.recipient].codeHash)
    }
    res.states[tx.recipient].balance = (BigInt(res.states[tx.recipient].balance) + BigInt(tx.amount)).toString()
    // Contract deployment
    if (res.states[txSenderAddress].codeHash === EMPTY_HASH && typeof tx.additionalData.scBody === "string") {
        res.states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
        res.code[res.states[txSenderAddress].codeHash] = tx.additionalData.scBody
    }
    // Update nonce
    res.states[txSenderAddress].nonce += 1
    // Decide to drop or add transaction to block
    if (BigInt(res.states[txSenderAddress].balance) < 0n) {
        res.skipped[txSenderAddress] = true
        return res
    } else {
        res.txnsToMine.push(tx)
        res.tContractGas += BigInt(tx.additionalData.contractGas || 0)
        tTxGas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0)
    }

    // Contract execution
    if (res.states[tx.recipient].codeHash !== EMPTY_HASH) {
        const contractInfo = { address: tx.recipient }
        const [newState, newStorage] = await drisscript(res.code[res.states[tx.recipient].codeHash], res.states, BigInt(tx.additionalData.contractGas || 0), stateDB, block, tx, contractInfo, false)
        for (const account of Object.keys(newState)) {
            res.states[account] = newState[account]
            res.storage[tx.recipient] = newStorage
        }
        
    }

    return res
}

module.exports = execTx