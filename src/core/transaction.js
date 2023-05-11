"use strict";

const BN = require("bn.js");
const { isNumber } = require("../utils/utils");
const crypto = require("crypto");
const { createHash } = crypto;
const ec = new (require("elliptic").ec)("secp256k1");
const { EMPTY_HASH } = require("../config.json");

class Transaction {
  constructor(
    recipient = "",
    amount = "0",
    gas = "1000000000000",
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
    });
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
      .digest("hex");
  }

  static sign(transaction, keyPair) {
    const sigObj = keyPair.sign(Transaction.getHash(transaction));
    Object.assign(transaction.signature, {
      v: sigObj.recoveryParam.toString(16),
      r: sigObj.r.toString(16),
      s: sigObj.s.toString(16),
    });
  }

  static getPubKey(tx) {
    const sigObj = {
      r: new BN(tx.signature.r, 16),
      s: new BN(tx.signature.s, 16),
      recoveryParam: parseInt(tx.signature.v, 16),
    };
    const msgHash = Transaction.getHash(tx);
    const txSenderPubkey = ec.recoverPubKey(
      new BN(msgHash, 16).toString(10),
      sigObj,
      ec.getKeyRecoveryParam(msgHash, sigObj, ec.genKeyPair().getPublic())
    );
    return ec.keyFromPublic(txSenderPubkey).getPublic("hex");
  }

  static async isValid(tx, stateDB) {
    const { recipient, amount, gas, additionalData, nonce } = tx;
    const { contractGas } = additionalData;
    if (
      !(
        typeof recipient === "string" &&
        typeof amount === "string" &&
        typeof gas === "string" &&
        typeof additionalData === "object" &&
        typeof nonce === "number" &&
        (typeof contractGas === "undefined" ||
          (typeof contractGas === "string" && isNumber(contractGas))) &&
        isNumber(amount) &&
        isNumber(gas)
      )
    ) {
      return false;
    }
    const txSenderPubkey = Transaction.getPubKey(tx);
    const txSenderAddress = createHash("sha256")
      .update(txSenderPubkey)
      .digest("hex");
    if (!(await stateDB.keys().all()).includes(txSenderAddress)) {
      return false;
    }
    const { balance, codeHash } = await stateDB.get(txSenderAddress);
    if (codeHash !== EMPTY_HASH) {
      return false;
    }
    return (
      BigInt(balance) >=
        BigInt(amount) + BigInt(gas) + BigInt(contractGas || 0) &&
      BigInt(gas) >= 1000000000000n &&
      BigInt(amount) >= 0
    );
  }
}

module.exports = Transaction;
