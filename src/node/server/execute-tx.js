const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const Transaction = require("../../core/transaction")
const drisscript = require("../../core/runtime")
const { EMPTY_HASH } = require("../../config.json")

const executeTx = async (tx, totalContractGas, totalTxGas, transactionsToMine, stateDB, codeDB, states, code, skipped, storedAddresses, fastify) => {
    const txSenderPubkey = Transaction.getPubKey(tx)
    const txSenderAddress = SHA256(txSenderPubkey)
    if (skipped[txSenderAddress]) return // Check if transaction is from an ignored address.
    // Normal coin transfers
    if (!states[txSenderAddress]) {
        const senderState = await stateDB.get(txSenderAddress)
        states[txSenderAddress] = senderState
        code[senderState.codeHash] = await codeDB.get(senderState.codeHash)
        if (senderState.codeHash !== EMPTY_HASH) {
            skipped[txSenderAddress] = true
            return
        }
        states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
    } else {
        if (states[txSenderAddress].codeHash !== EMPTY_HASH) {
            skipped[txSenderAddress] = true
            return
        }
        states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
    }
    if (!storedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
        states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
        code[EMPTY_HASH] = ""
    }
    if (storedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
        states[tx.recipient] = await stateDB.get(tx.recipient)
        code[states[tx.recipient].codeHash] = await codeDB.get(states[tx.recipient].codeHash)
    }
    states[tx.recipient].balance = (BigInt(states[tx.recipient].balance) + BigInt(tx.amount)).toString()
    // Contract deployment
    if (states[txSenderAddress].codeHash === EMPTY_HASH && typeof tx.additionalData.scBody === "string") {
        states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
        code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
    }
    // Update nonce
    states[txSenderAddress].nonce += 1
    // Decide to drop or add transaction to block
    if (BigInt(states[txSenderAddress].balance) < 0n) {
        skipped[txSenderAddress] = true
        return
    } else {
        transactionsToMine.push(tx)
        totalContractGas += BigInt(tx.additionalData.contractGas || 0)
        totalTxGas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0)
    }

    // Contract execution
    if (states[tx.recipient].codeHash !== EMPTY_HASH) {
        const contractInfo = { address: tx.recipient }
        const [newState, newStorage] = await drisscript(code[states[tx.recipient].codeHash], states, BigInt(tx.additionalData.contractGas || 0), stateDB, block, tx, contractInfo, false)
        for (const account of Object.keys(newState)) {
            states[account] = newState[account]
            storage[tx.recipient] = newStorage
        }
    }
}

module.exports = executeTx