"use strict"

const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")
const Transaction = require("../core/transaction")
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
  logger: false
})

const getBlockNumber = async blockDB => {
  return { blockNumber: Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))) }
}


const getAddress = client => {
  return { address: SHA256(client.pK) }
}

const getWork = async blockDB => {
  const latestBlock = await blockDB.get(Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))).toString())
  return { hash: latestBlock.hash, nonce: latestBlock.nonce }
}

const getMining = client => {
  return { mining: client.mining }
}

const getBlockByHash = async (params, bhashDB, blockDB) => {
  if (typeof params !== "object" || typeof params._hash !== "string") {
    return "Invalid prop types."
  }
  const { _hash } = params
  const hashes = await bhashDB.keys().all()
  if (!hashes.includes(_hash)) {
    return "Invalid block hash."
  }
  const blockNumber = await bhashDB.get(_hash)
  const block = await blockDB.get(blockNumber)
  return { block }
}

const getBlockByNumber = async (params, blockDB) => {
  if (typeof params !== "object" || typeof params.blockNumber !== "number") {
    return "Invalid prop types."
  }
  const { blockNumber } = params
  const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)))
  if (blockNumber <= 0 || blockNumber > currentBlockNumber) {
    return "Invalid block number."
  }
  else {
    const block = await blockDB.get(blockNumber.toString())
    return { block }
  }
}

const getBlockTxnCountByHash = async (params, bhashDB, blockDB) => {
  if (typeof params !== "object" || typeof params._hash !== "string") {
    return "Invalid prop types."
  }
  const { _hash } = params
  const hashes = await bhashDB.keys().all()
  if (!hashes.includes(_hash)) {
    return "Invalid block hash."
  }
  const blockNumber = await bhashDB.get(_hash)
  const block = await blockDB.get(blockNumber)
  return { count: block.transactions.length }
}

const getBlockTxnCountByNumber = async (params, blockDB) => {
  const { blockNumber } = params
  if (typeof params !== "object" || typeof blockNumber !== "number") {
    return "Invalid prop types."
  }
  else {
    const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map((key) => parseInt(key)))
    if (blockNumber <= 0 || blockNumber > currentBlockNumber) {
      return "Invalid block number."
    }
    else {
      const block = await blockDB.get(blockNumber.toString())
      return { count: block.transactions.length }
    }
  }
}

const getBalance = async (params, stateDB) => {
  const { address } = params
  if
    (
    typeof params !== "object" ||
    typeof address !== "string" ||
    !(await stateDB.keys().all()).includes(address)
  ) {
    return "Invalid prop types."
  }

  const targetState = await stateDB.get(address)
  const targetBalance = targetState.balance
  return { balance: targetBalance }
}

const getCode = async (params, codeDB) => {
  const { codeHash } = params
  if
    (
    typeof params !== "object" ||
    typeof codeHash !== "string" ||
    !(await codeDB.keys().all()).includes(codeHash)
  ) {
    return "Invalid prop types."
  }
  else {
    return { code: await codeDB.get(codeHash) }
  }
}

const getCodeHash = async (params, stateDB) => {
  const { address } = params
  if
    (
    typeof params !== "object" ||
    typeof address !== "string" ||
    !(await stateDB.keys().all()).includes(address)
  ) {
    return "Invalid prop types."
  }
  else {
    const dataFromTarget = await stateDB.get(address) // Fetch target's state object
    return { codeHash: dataFromTarget.codeHash }
  }
}

const getStorage = async (params, stateDB) => {
  const { address, key } = params
  if
    (
    typeof params !== "object" ||
    typeof address !== "string" ||
    typeof key !== "string" ||
    !(await stateDB.keys().all()).includes(address)
  ) {
    return "Invalid prop types."
  }

  else {
    const storageDB = new Level(__dirname + "/../log/accountStore/" + contractInfo.address)
    storageDB.close()
    return { storage: await storageDB.get(key) }
  }
}

const getStorageKeys = async (params, stateDB) => {
  const { address } = params
  if
    (
    typeof address !== "string" ||
    !(await stateDB.keys().all()).includes(address)
  ) {
    return "Invalid prop types."
  }
  else {
    const storageDB = new Level(__dirname + "/../log/accountStore/" + contractInfo.address)
    return { storage: await storageDB.keys().all() }
  }
}

const getStorageRoot = async (params, stateDB) => {
  const { address } = params
  if
    (
    typeof address !== "string" ||
    !(await stateDB.keys().all()).includes(address)
  ) {
    return "Invalid prop types."
  }
  else {
    return { storageRoot: (await stateDB.get(contractInfo.address)).storageRoot }
  }
}

const getTxnByBlockNumberAndIndex = async (params, blockDB) => {
  const { index, blockNumber } = params
  if
    (
    typeof params !== "object" ||
    typeof blockNumber !== "number" ||
    typeof index !== "number"
  ) {
    return "Invalid prop types."
  }
  else {
    const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)))
    if (blockNumber <= 0 || blockNumber > currentBlockNumber) {
      return "Invalid block number."
    }
    else {
      const block = await blockDB.get(blockNumber.toString())
      if (index < 0 || index >= block.transactions.length) {
        return "Invalid transaction index."
      }
      else {
        return { transaction: block.transactions[index] }
      }
    }
  }

}

const getTxnByBlockHashAndIndex = async (params, bhashDB, blockDB) => {
  const { _hash, index } = params
  if
    ( typeof params !== "object" || typeof _hash !== "string" || typeof index !== "number" ) {
    return "Invalid prop types."
  }
  else {
    const hashes = (await bhashDB.keys().all())
    if (!hashes.find(hash => hash === _hash)) {
      return "Invalid block hash."
    }
    else {
      const blockNumber = await bhashDB.get(_hash)
      const block = await blockDB.get(blockNumber)
      if (index < 0 || index >= block.transactions.length) {
        return "Invalid transaction index."
      }
      else {
        return { transaction: block.transactions[index] }
      }
    }
  }
}

const sendTxn = async (params, txHandler) => {
  const { tx } = params
  if ( typeof params !== "object" || typeof tx !== "object" ) {
    return "Invalid prop types."
  }
  else {
    try {
      await txHandler(tx)
      return { message: "Transaction received on Drisseum." }
    }
    catch (error) {
      console.error(error)
      return "Error processing transaction."
    }
  }
}


const signTxn = (params, keyPair) => {
  const { recipient, amount } = params
  if ( typeof params !== "object" || typeof recipient !== "string" || typeof amount !== "number" ) {
    return "Invalid prop types."
  }
  else {
    const tx = new Transaction({ recipient, amount, nonce: 1 })
    Transaction.sign(tx, keyPair)
    return { tx }
  }
}

/**
 * @param PORT rpc port
 * @param client  obj {pK, mining: ENABLE_MINING}
 * @param txHandler sendTx
*/
const rpc = (PORT, client, txHandler, keyPair, stateDB, blockDB, bhashDB, codeDB) => {
  const handleRPC = async (request, reply) => {
    const { method, params, id } = request.body
    const genResponse = (result, id) => {
      return { jsonrpc: '2.0', data: result, id: id }
    }
    let result
    switch (method) {
      case 'getBlockNumber':
        result = await getBlockNumber(blockDB)
        break
      case 'getAddress':
        result = getAddress(client)
        fastify.log.info(client)
        break
      case 'getWork':
        result = await getWork(blockDB)
        break
      case 'getMining':
        result = getMining(client)
        break
      case 'getBlockByHash':
        result = await getBlockByHash(params, bhashDB, blockDB)
        break
      case 'getBlockByNumber':
        result = await getBlockByNumber(params, blockDB)
        break
      case 'getBlockTxnCountByHash':
        result = await getBlockTxnCountByHash(params, bhashDB, blockDB)
        break
      case 'getBlockTxnCountByNumber':
        result = await getBlockTxnCountByNumber(params, blockDB)
        break
      case 'getBalance':
        result = await getBalance(params, stateDB)
        break
      case 'getCode':
        result = await getCode(params, codeDB)
        break
      case 'getCodeHash':
        result = await getCodeHash(params, stateDB)
        break
      case 'getStorage':
        result = await getStorage(params, stateDB)
        break
      case 'getStorageKeys':
        result = await getStorageKeys(params, stateDB)
        break
      case 'getStorageRoot':
        result = await getStorageRoot(params, stateDB)
        break
      case 'getTxnByBlockNumberAndIndex':
        result = await getTxnByBlockNumberAndIndex(params, blockDB)
        break
      case 'getTxnByBlockHashAndIndex':
        result = await getTxnByBlockHashAndIndex(params, bhashDB)
        break
      case 'sendTxn':
        result = await sendTxn(params, txHandler)
        break
      case 'signTxn':
        result = await signTxn(params, keyPair)
        break
      default:
        result = 'Method not found.'
    }
    return genResponse(result, id)
  }



  // Start the RPC server
  const main = () => {
    fastify.post('/jsonrpc', async (request, reply) => {
      try {
        const response = await handleRPC(request, reply)
        return { response }
      }
      catch (error) {
        return { error: { code: -32000, message: 'JSON-RPC error: ' + error.message } }
      }
    })
    fastify.listen({ port: PORT }, (err) => {
      if (err) {
        fastify.log.error(err)
        process.exit(1)
      }
    })
  }
  return main
}

module.exports = rpc