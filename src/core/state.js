"use strict"

const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const EC = require("elliptic").ec, ec = new EC("secp256k1")
const Transaction = require("./transaction")
const processReward = require("./state/reward")
const exeContract = require("./state/contract")
const { EMPTY_HASH } = require("../config.json")
const DEFAULT_STATE_OBJECT = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }

/** 
 * Manually changes the Drisseum chain state
 * */
const changeState = async (nB, stateDB, codeDB) => {
    const storedAddresses = await stateDB.keys().all()
    for (const tx of nB.transactions) {
        // If the address doesn't already exist in the chain state, we will create a new empty one.
        if (!storedAddresses.includes(tx.recipient)) {
            await stateDB.put(tx.recipient, DEFAULT_STATE_OBJECT)
        }
        // Get sender's public key and address
        const txSenderPubkey = Transaction.getPubKey(tx)
        const txSenderAddress = SHA256(txSenderPubkey)
        // If the address doesn't already exist in the chain state, we will create a new empty one.
        if (!storedAddresses.includes(txSenderAddress)) {
            await stateDB.put(txSenderAddress, DEFAULT_STATE_OBJECT)
        } else if (typeof tx.additionalData.scBody === "string") { // Contract deployment
            const senderState = await stateDB.get(txSenderAddress)
            if (senderState.codeHash === EMPTY_HASH) {
                senderState.codeHash = SHA256(tx.additionalData.scBody)
                await codeDB.put(senderState.codeHash, tx.additionalData.scBody)
                await stateDB.put(txSenderAddress, senderState)
            }
        }
        // Normal transfer
        const senderState = await stateDB.get(txSenderAddress)
        const recipientState = await stateDB.get(tx.recipient)
        await stateDB.put(txSenderAddress, {
            balance: (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt((tx.additionalData.contractGas || 0))).toString(),
            codeHash: senderState.codeHash,
            nonce: senderState.nonce + 1, // Update nonce
            storageRoot: senderState.storageRoot
        })
        await stateDB.put(tx.recipient, {
            balance: (BigInt(recipientState.balance) + BigInt(tx.amount)).toString(),
            codeHash: recipientState.codeHash,
            nonce: recipientState.nonce,
            storageRoot: recipientState.storageRoot
        })
        // Contract execution
        if (recipientState.codeHash !== EMPTY_HASH) {
            await exeContract(tx, nB, stateDB, codeDB, recipientState)
        }
    }

    await processReward(nB, storedAddresses, stateDB)
}

module.exports = changeState
