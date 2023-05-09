const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const Block = require("../core/block");
const { log16 } = require("../utils/utils");
const { buildMerkleTree } = require("../core/merkle");
const { BLOCK_REWARD, BLOCK_TIME } = require("../config.json");
const { indexTxns } = require("../utils/utils");

/**
 * Checks if a block is valid under specified conditions.
*/
async function verifyBlock(newBlock, chainInfo, stateDB, codeDB, enableLogging = false) 
{
    return (
        Block.hasValidPropTypes(newBlock) &&
        SHA256(
            newBlock.blockNumber.toString()       + 
            newBlock.timestamp.toString()         + 
            newBlock.txRoot                       + 
            newBlock.difficulty.toString()        +
            chainInfo.latestBlock.hash            +
            newBlock.nonce.toString()
        ) === newBlock.hash &&
        chainInfo.latestBlock.hash === newBlock.parentHash &&
        newBlock.hash.startsWith("00000" + Array(Math.floor(log16(chainInfo.difficulty)) + 1).join("0")) &&
        newBlock.difficulty === chainInfo.difficulty &&
        await Block.hasValidTxOrder(newBlock, stateDB) &&
        newBlock.timestamp > chainInfo.latestBlock.timestamp &&
        newBlock.timestamp < Date.now() &&
        newBlock.blockNumber - 1 === chainInfo.latestBlock.blockNumber &&
        buildMerkleTree(indexTxns(newBlock.transactions)).val === newBlock.txRoot &&
        Block.hasValidGasLimit(newBlock) &&
        await Block.verifyTxAndTransit(newBlock, stateDB, codeDB, enableLogging)
    )
}

async function updateDifficulty(newBlock, chainInfo, blockDB) 
{
    if (newBlock.blockNumber % 10 === 0) 
    {
        const oldBlock = await blockDB.get((newBlock.blockNumber - 9).toString());
        chainInfo.difficulty = Math.ceil(chainInfo.difficulty *  10* BLOCK_TIME / (newBlock.timestamp - oldBlock.timestamp));
    }
}

module.exports = { verifyBlock, updateDifficulty };
