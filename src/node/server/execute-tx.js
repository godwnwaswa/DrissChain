
const Transaction = require("../../core/transaction")

const executeTx = async (tx) => {
    if (totalContractGas + BigInt(tx.additionalData.contractGas || 0) >= BigInt(BLOCK_GAS_LIMIT)) break
        const txSenderPubkey = Transaction.getPubKey(tx)
        const txSenderAddress = SHA256(txSenderPubkey)
        if (skipped[txSenderAddress]) continue // Check if transaction is from an ignored address.
        // Normal coin transfers
        if (!states[txSenderAddress]) {
            const senderState = await stateDB.get(txSenderAddress)
            states[txSenderAddress] = senderState
            code[senderState.codeHash] = await codeDB.get(senderState.codeHash)
            if (senderState.codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true
                continue
            }
            states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
        } else {
            if (states[txSenderAddress].codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true
                continue
            }
            states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
        }
        if (!existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
            code[EMPTY_HASH] = ""
        }
        if (existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = await stateDB.get(tx.recipient)
            code[states[tx.recipient].codeHash] = await codeDB.get(states[tx.recipient].codeHash)
        }
        states[tx.recipient].balance = (BigInt(states[tx.recipient].balance) + BigInt(tx.amount)).toString()
        // Contract deployment
        if (states[txSenderAddress].codeHash === EMPTY_HASH && typeof tx.additionalData.scBody === "string" ) {
            states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
            code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
        }
        // Update nonce
        states[txSenderAddress].nonce += 1
        // Decide to drop or add transaction to block
        if (BigInt(states[txSenderAddress].balance) < 0n) {
            skipped[txSenderAddress] = true
            continue
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