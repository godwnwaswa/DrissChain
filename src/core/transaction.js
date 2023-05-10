"use strict"

const BN = require("bn.js") //arbitrary-precision integer arithmetic.
const { isNumber } = require("../utils/utils")
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const EC = require("elliptic").ec, ec = new EC("secp256k1")

const { EMPTY_HASH } = require("../config.json")

class Transaction 
{
    constructor(recipient = "", amount = "0", gas = "1000000000000", additionalData = {}, nonce = 0) 
    {
        this.recipient      = recipient      // Recipient's address (public key)
        this.amount         = amount         // Amount to be sent
        this.gas            = gas            // Gas that transaction consumed + tip for miner
        this.additionalData = additionalData // Additional data that goes into the transaction
        this.nonce          = nonce           // Nonce for signature entropy
        this.signature      = {}             // Transaction's signature, will be generated later
    }

    static getHash(tx) 
    {
        return SHA256
        (
            tx.recipient                      +
            tx.amount                         +
            tx.gas                            +
            JSON.stringify(tx.additionalData) +
            tx.nonce.toString()
        )
    }

    static sign(transaction, keyPair) 
    {
        const sigObj = keyPair.sign(Transaction.getHash(transaction))
        transaction.signature = 
        {
            v: sigObj.recoveryParam.toString(16),
            r: sigObj.r.toString(16),
            s: sigObj.s.toString(16)
        }
    }

    static getPubKey(tx) 
    {
        // Get transaction's body's hash and recover original signature object
        const msgHash = Transaction.getHash(tx)
        const sigObj = {
            r: new BN(tx.signature.r, 16),
            s: new BN(tx.signature.s, 16),
            recoveryParam: parseInt(tx.signature.v, 16)
        }
        // Recover public key and get real address.
        const txSenderPubkey = ec.recoverPubKey
        (
            new BN(msgHash, 16).toString(10),
            sigObj,
            ec.getKeyRecoveryParam(msgHash, sigObj, ec.genKeyPair().getPublic())
        )
        return ec.keyFromPublic(txSenderPubkey).getPublic("hex")
    }

    /**
     * ----------------------------------------------------------------------------------------------------------------------------
     * The method first checks that the types of the properties of the `tx` object are valid, then tries to recover the public key 
     * associated with the transaction's signature. If this fails, the method returns `false`. If the public key can be recovered, 
     * the method computes the sender's address using the SHA256 hash of the sender's public key. If the state of the sender does 
     * not exist, the method returns `false`. If the sender's address is associated with a contract, the method returns `false`. 
     * Finally, the method checks that the sender has enough balance to pay for the transaction's cost and that the transaction's 
     * amount is at least 0.
     * -----------------------------------------------------------------------------------------------------------------------------
     * */
    static async isValid(tx, stateDB) 
    {
        if (
            !(
            typeof tx.recipient      === "string" &&
            typeof tx.amount         === "string" &&
            typeof tx.gas            === "string" &&
            typeof tx.additionalData === "object" &&
            typeof tx.nonce          === "number" &&
            (
                typeof tx.additionalData.contractGas === "undefined" ||
                (
                    typeof tx.additionalData.contractGas === "string" &&
                    isNumber(tx.additionalData.contractGas)
                )
            ) &&
            isNumber(tx.amount) &&
            isNumber(tx.gas)
        )) { return false }
        let txSenderPubkey
        // If recovering public key fails, then transaction is not valid.
        try 
        {
            txSenderPubkey = Transaction.getPubKey(tx)
        } 
        catch (e) 
        {
            return false
        }
        const txSenderAddress = SHA256(txSenderPubkey)
        // If state of sender does not exist, then the transaction is 100% false
        if (!(await stateDB.keys().all()).includes(txSenderAddress)) return false
        // Fetch sender's state object
        const dataFromSender = await stateDB.get(txSenderAddress)
        const senderBalance = dataFromSender.balance
        // If sender is a contract address, then it's not supposed to be used to send money, so return false if it is.
        if (dataFromSender.codeHash !== EMPTY_HASH) return false
        return (
            // Check if balance of sender is enough to fulfill transaction's cost.
            (
                BigInt(senderBalance) >= BigInt(tx.amount) + BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0) && 
                BigInt(tx.gas) >= 1000000000000n
            ) &&
            BigInt(tx.amount) >= 0 // Transaction's amount must be at least 0.
        )
    }
}

module.exports = Transaction
