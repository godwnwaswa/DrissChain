"use strict"

const BN = require("bn.js")
const { isNumber } = require("../utils/utils")
const crypto = require("crypto")
const { createHash } = crypto
const ec = new (require("elliptic").ec)("secp256k1")
const { EMPTY_HASH } = require("../config.json")

class Transaction {
  constructor(
    recipient = "",
    amount = "0",
    gas = '2000000000', //base gas fee
    additionalData = {},
    nonce = 0
  ) {
    Object.assign(this, {
      recipient,
      amount,
      gas, 
      additionalData,
      nonce,
      signature: {},
    })
  }

  static getHash(tx) {
    return createHash("sha256")
      .update(
        [
          tx.recipient,
          tx.amount,
          tx.gas,
          JSON.stringify(tx.additionalData),
          tx.nonce.toString(),
        ].join("")
      )
      .digest("hex")
  }

  static sign(transaction, keyPair) {
    const sigObj = keyPair.sign(Transaction.getHash(transaction))
    Object.assign(transaction.signature, {
      v: sigObj.recoveryParam.toString(16),
      r: sigObj.r.toString(16),
      s: sigObj.s.toString(16),
    })
  }

  static getPubKey(tx) {
    const sigObj = {
      r: new BN(tx.signature.r, 16),
      s: new BN(tx.signature.s, 16),
      recoveryParam: parseInt(tx.signature.v, 16),
    }
    const txHash = Transaction.getHash(tx)
    const senderPubkey = ec.recoverPubKey(
      new BN(txHash, 16).toString(10),
      sigObj,
      ec.getKeyRecoveryParam(txHash, sigObj, ec.genKeyPair().getPublic())
    )
    return ec.keyFromPublic(senderPubkey).getPublic("hex")
  }

  static async isValid(tx, stateDB) {
    const { recipient, amount, gas, additionalData, nonce } = tx
    const { contractGas } = additionalData
    //validate tx prop types
    if (
      !(
        typeof recipient === "string" && typeof amount === "string" &&
        typeof gas === "string" && typeof additionalData === "object" &&
        typeof nonce === "number" && isNumber(amount) && isNumber(gas) &&
        // contract gas is undefined for txns made to EOA
        (typeof contractGas === "undefined" || (typeof contractGas === "string" && isNumber(contractGas))) 
        
      )
    ) {
      return false
    }
    const senderPubKey = Transaction.getPubKey(tx)
    const senderAddress = createHash("sha256").update(senderPubKey).digest("hex")
    // sender is not part of the chain state
    if (!(await stateDB.keys().all()).includes(senderAddress)) {
      return false
    }
    // stateDB tracks account type & balance
    const { balance, codeHash } = await stateDB.get(senderAddress)
    //codeHash is used to deploy a smart contract; it's a the has of the smart contract's code.
    //txns to EOA have a default value of EMPTY_HASH for the codeHash; implying they're not targetting a smart contract address 
    //EMPTY_HASH is a hash of an empty string ("")
    if (codeHash !== EMPTY_HASH) {
      return false //?handle the smart contract
    }
    return (
      BigInt(balance) >= BigInt(amount) + BigInt(gas) + BigInt(contractGas || 0) &&
      BigInt(gas) >= 2000000000n && BigInt(amount) >= 0
    )
  }
}

module.exports = Transaction
