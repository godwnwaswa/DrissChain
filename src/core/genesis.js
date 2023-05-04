/**
 * --------------------------------------------------------------------------------
 * The `SHA256` constant is a function that takes a `message` parameter and returns 
 * a hexadecimal hash of the message using the SHA-256 algorithm.
 * --------------------------------------------------------------------------------
 * */

const EC = require("elliptic").ec, ec = new EC("secp256k1");
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");

const Block = require("./block");
const Transaction = require("./transaction");
const { FIRST_ACCOUNT } = require("../config.json");


/**
 * ----------------------------------------------------------
 * a. `1` for the `index` parameter:
 * 
 * This is the first block in the chain (the "genesis" block)
 * -----------------------------------------------------------
 * 
 * -----------------------------------------------------------
 * b. `Date.now()` for the `timestamp` parameter:
 * 
 * Sets the time the block is created to the current time
 * -----------------------------------------------------------
 * 
 * -----------------------------------------------------------
 * c. An empty array `[]` for the `transactions` parameter:
 * 
 * There are no transactions in the genesis block
 * -----------------------------------------------------------
 * 
 * -----------------------------------------------------------------------------------------------
 * d. `1` for the `difficulty` parameter:
 * 
 * Sets the mining difficulty of the block to 1 (since there are no other blocks to compare it to)
 * -----------------------------------------------------------------------------------------------
 * 
 * --------------------------------------------------------
 * e. An empty string `""` for the `previousHash` parameter:
 * 
 * There is no previous block in the chain
 * --------------------------------------------------------
 * 
 * -----------------------------------------------------------------------
 * f. `FIRST_ACCOUNT` for the `minerAddress` parameter:
 * 
 * It's the address that receives the mining reward for the genesis block.
 * -----------------------------------------------------------------------
 * 
 * */
function generateGenesisBlock() {
    return new Block(1, Date.now(), [], 1, "", FIRST_ACCOUNT);
}

module.exports = generateGenesisBlock;
