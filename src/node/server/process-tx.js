const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const Transaction = require("../../core/transaction")
const drisscript = require("../../core/runtime")
const { EMPTY_HASH } = require("../../config.json")
const DEFAULT_STATE_OBJECT = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
/**
 * Executes a single tx in the txPool
 * @param tContractGas total contract gas
 * @param tTxGas  total tranction gas
 * @param tx transaction
 * @param txnsToMine transactions to mine
*/
const processTx = async ( tx, tContractGas, tTxGas, txnsToMine, stateDB, codeDB,
    states, code, skipped, storage, storedAddresses, fastify) => {

    const txSenderPubkey = Transaction.getPubKey(tx)
    const txSenderAddress = SHA256(txSenderPubkey)
    if (skipped[txSenderAddress]) return // Check if transaction is from an ignored address.
    // 1st tx hit from this address >> not in `states` object yet
    if (!states[txSenderAddress]) {
        fastify.log.info('##start## processsing a normal coin transfer')
        // retrieve sender's state object from stateDB
        const senderState = await stateDB.get(txSenderAddress)
        // add the state to the `states` object with sender's address as the key
        states[txSenderAddress] = senderState
        // retrieve the `state object's` code from the codeDB & add it to the `code` object >> key = senderState.codeHash
        code[senderState.codeHash] = await codeDB.get(senderState.codeHash)
    }

    // skip if it state object's codeHash is not originally EMPTY_HASH >> add to `skipped` object
    if (states[txSenderAddress].codeHash !== EMPTY_HASH) {
        skipped[txSenderAddress] = true
        return res
    }
    // update the sender's balance >> subtract tx.amount, tx.gas, tx.additionalData.contractGas
    states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()

    // if recipient's address is not in stateDB and not in `states` object; create assign the default state object
    if (!storedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
        states[tx.recipient] = DEFAULT_STATE_OBJECT
        code[EMPTY_HASH] = ""
    }
    // if recipient's address is in stateDB and not in `states` object
    if (storedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
        states[tx.recipient] = await stateDB.get(tx.recipient)
        code[states[tx.recipient].codeHash] = await codeDB.get(states[tx.recipient].codeHash)
    }
    // update the recipient's balance >> add tx.amount
    states[tx.recipient].balance = (BigInt(states[tx.recipient].balance) + BigInt(tx.amount)).toString()

    // Contract deployment >> tx.additionalData.scBody contains smart contract's code
    if (states[txSenderAddress].codeHash === EMPTY_HASH && typeof tx.additionalData.scBody === "string") {
        states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
        code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
    }
    // Update sender state object's nonce 
    states[txSenderAddress].nonce += 1

    // Decide to drop or add transaction to block
    if (BigInt(states[txSenderAddress].balance) < 0n) {
        skipped[txSenderAddress] = true
        return res
    }

    txnsToMine.push(tx)
    tContractGas += BigInt(tx.additionalData.contractGas || 0)
    tTxGas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0)

    // Contract execution
    if (states[tx.recipient].codeHash !== EMPTY_HASH) {
        const contractInfo = { address: tx.recipient }
        const [newState, newStorage] = await drisscript(code[states[tx.recipient].codeHash], 
            states, BigInt(tx.additionalData.contractGas || 0), stateDB, block, tx, contractInfo )

        for (const account of Object.keys(newState)) {
            states[account] = newState[account]
            storage[tx.recipient] = newStorage
        }

    }

    return { tContractGas, tTxGas, states, code, txnsToMine, storage, skipped }
}

module.exports = processTx