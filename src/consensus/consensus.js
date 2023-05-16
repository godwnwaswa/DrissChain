const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const Block = require("../core/block");
const { log16 } = require("../utils/utils");
const { buildMerkleTree } = require("../core/merkle");
const { BLOCK_REWARD, BLOCK_TIME } = require("../config.json");
const { indexTxns } = require("../utils/utils");


const pino = require('pino')
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'pid,hostname',
    },
  },
})
const fastify = require('fastify')({
  logger : logger
})

/**
 * Checks if a block is valid under specified conditions.
 * @param nB new block
*/
const verifyBlock = async (nB, chainInfo, stateDB, codeDB, enableLogging = false) => {
    return (
        Block.hasValidPropTypes(nB) && 
        SHA256(`${nB.blockNumber.toString()}${nB.timestamp.toString()}${nB.txRoot}${nB.difficulty.toString()}${chainInfo.latestBlock.hash}${nB.nonce.toString()}`) === nB.hash &&
        chainInfo.latestBlock.hash === nB.parentHash && 
        nB.hash.startsWith("00000" + Array(Math.floor(log16(chainInfo.difficulty)) + 1).join("0")) && 
        nB.difficulty === chainInfo.difficulty && 
        await Block.hasValidTxOrder(nB, stateDB) && 
        nB.timestamp > chainInfo.latestBlock.timestamp && 
        nB.timestamp < Date.now() &&
        nB.blockNumber - 1 === chainInfo.latestBlock.blockNumber &&
        buildMerkleTree(indexTxns(nB.transactions)).val === nB.txRoot &&
        Block.hasValidGasLimit(nB) &&
        await Block.verifyTxAndTransit(nB, stateDB, codeDB, enableLogging)
    )
}

const updateDifficulty = async (nB, chainInfo, blockDB) => {
    if (nB.blockNumber % 10 === 0) 
    {
        const oldBlock = await blockDB.get((nB.blockNumber - 9).toString());
        chainInfo.difficulty = Math.ceil(chainInfo.difficulty *  10* BLOCK_TIME / (nB.timestamp - oldBlock.timestamp));
    }
}

module.exports = { verifyBlock, updateDifficulty };
