"use strict";

const { Level } = require('level');
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec, ec = new EC("secp256k1");

const jelscript = require("./runtime");
const Transaction = require("./transaction");

const { EMPTY_HASH, BLOCK_REWARD } = require("../config.json");

/**
 * --------------------------------------------------------------------------------------------------------------
 * Updates the blockchain's state according to the transactions included in a newly created block. It does so by 
 * modifying the `stateDB` object, which represents the current state of the blockchain, and the `codeDB` object, 
 * which represents the code of any smart contracts deployed on the blockchain. 
 * --------------------------------------------------------------------------------------------------------------
 * 
 * --------------------------------------------------------------------------------------------------------------
 * It 1st retrieves all the existing addresses in the blockchain's state database (`stateDB.keys().all()`), which  
 * will be used to check whether new addresses need to be created. It then iterates over each transaction in the 
 * new block and processes it according to its type (normal transfer or smart contract execution).
 * --------------------------------------------------------------------------------------------------------------
 * 
 * 
 * ---------------------------------------------------------------------------------------------------------------
 * If the recipient of the transaction is a new address that does not yet exist in the state database, a new empty 
 * state object is created for that address. Similarly, if the sender's address does not yet exist in the state 
 * database, a new empty state object is created for that address. 
 * ---------------------------------------------------------------------------------------------------------------
 * 
 * 
 * ---------------------------------------------------------------------------------------------------------------
 * If the transaction is a smart contract deployment, the function checks whether the sender has already deployed 
 * a contract to that address. If not, it creates a new contract object and stores it in the `codeDB` object. 
 * ---------------------------------------------------------------------------------------------------------------
 * 
 * ---------------------------------------------------------------------------------------------------------------
 * If the transaction is a normal transfer, the function updates the state of the sender and recipient addresses 
 * by subtracting or adding the transaction amount, gas fee, and any additional contract gas fee.
 * ---------------------------------------------------------------------------------------------------------------
 * 
 * ---------------------------------------------------------------------------------------------------------------
 * If the recipient of the transaction has a code hash associated with it (i.e., a smart contract is deployed at 
 * that address), the function executes the contract code using the `jelscript` function, passing in the contract 
 * code, the current state database, the new block, the transaction, and some additional information about the 
 * contract.
 * ---------------------------------------------------------------------------------------------------------------
 * 
 * ---------------------------------------------------------------------------------------------------------------
 * After all transactions in the new block have been processed, the function calculates the block reward and adds 
 * it to the balance of the block's miner (i.e., the coinbase address). If the coinbase address does not exist in 
 * the state database, a new state object is created for it.
 * ---------------------------------------------------------------------------------------------------------------
 * 
 * 
 * 

 * */
async function changeState(newBlock, stateDB, codeDB, enableLogging = false) { // Manually change state
    const existedAddresses = await stateDB.keys().all();

    for (const tx of newBlock.transactions) {
        // If the address doesn't already exist in the chain state, we will create a new empty one.
        if (!existedAddresses.includes(tx.recipient)) {
            await stateDB.put(tx.recipient, { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH });
        }

        // Get sender's public key and address
        const txSenderPubkey = Transaction.getPubKey(tx);
        const txSenderAddress = SHA256(txSenderPubkey);

        // If the address doesn't already exist in the chain state, we will create a new empty one.
        if (!existedAddresses.includes(txSenderAddress)) {
            await stateDB.put(txSenderAddress, { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storage: EMPTY_HASH });
        } else if (typeof tx.additionalData.scBody === "string") { // Contract deployment
            const dataFromSender = await stateDB.get(txSenderAddress);

            if (dataFromSender.codeHash === EMPTY_HASH) {
                dataFromSender.codeHash = SHA256(tx.additionalData.scBody);
                
                await codeDB.put(dataFromSender.codeHash, tx.additionalData.scBody);

                await stateDB.put(txSenderAddress, dataFromSender);
            }
        }

        // Normal transfer
        const dataFromSender = await stateDB.get(txSenderAddress);
        const dataFromRecipient = await stateDB.get(tx.recipient);

        await stateDB.put(txSenderAddress, {
            balance: (BigInt(dataFromSender.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt((tx.additionalData.contractGas || 0))).toString(),
            codeHash: dataFromSender.codeHash,
            nonce: dataFromSender.nonce + 1, // Update nonce
            storageRoot: dataFromSender.storageRoot
        });

        await stateDB.put(tx.recipient, {
            balance: (BigInt(dataFromRecipient.balance) + BigInt(tx.amount)).toString(),
            codeHash: dataFromRecipient.codeHash,
            nonce: dataFromRecipient.nonce,
            storageRoot: dataFromRecipient.storageRoot
        });

        // Contract execution
        if (dataFromRecipient.codeHash !== EMPTY_HASH) {
            const contractInfo = { address: tx.recipient };

            const [ newState, newStorage ] = await jelscript(await codeDB.get(dataFromRecipient.codeHash), {}, BigInt(tx.additionalData.contractGas || 0), stateDB, newBlock, tx, contractInfo, enableLogging);

            const storageDB = new Level(__dirname + "/../log/accountStore/" + tx.recipient);
            const keys = Object.keys(newStorage);

            newState[tx.recipient].storageRoot = buildMerkleTree(keys.map(key => key + " " + newStorage[key])).val;

            for (const key in newStorage) {
                await storageDB.put(key, newStorage[key]);
            }

            await storageDB.close();

            for (const account of Object.keys(newState)) {
                await stateDB.put(account, newState[account]);

                await storageDB.close();
            }
        }
    }

    // Reward

    let gas = 0n;

    for (const tx of newBlock.transactions) { gas += BigInt(tx.gas) + BigInt() + BigInt(tx.additionalData.contractGas || 0) }

    if (!existedAddresses.includes(newBlock.coinbase)) {
        await stateDB.put(newBlock.coinbase, { balance: (BigInt(BLOCK_REWARD) + gas).toString(), codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH });
    } else {
        const minerState = await stateDB.get(newBlock.coinbase);

        minerState.balance = (BigInt(minerState.balance) + BigInt(BLOCK_REWARD) + gas).toString();

        await stateDB.put(newBlock.coinbase, minerState);
    }
}

module.exports = changeState;
