"use strict"

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
  logger : logger
})


async function getBlockNumber(blockDB)
{
  return { blockNumber: Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))) }
}

function getAddress(client)
{
  return { address: client.publicKey }
}

async function getWork(blockDB)
{
  const latestBlock = await blockDB.get(Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))).toString())   
  return { hash: latestBlock.hash, nonce: latestBlock.nonce }
}

function mining(client)
{
  return { mining: client.mining }
}

async function getBlockByHash(params, bhashDB, blockDB) 
{
  if (typeof params !== "object" || typeof params._hash !== "string") 
  {
    return "Invalid request."
  }

  const { _hash } = params
  const hashes = await bhashDB.keys().all()
  if (!hashes.includes(_hash)) 
  {
    return "Invalid block hash."
  }
  
  const blockNumber = await bhashDB.get(_hash)
  const block = await blockDB.get(blockNumber)
  
  return { block }
}


async function getBlockByNumber(params, blockDB) 
{
  if (typeof params !== "object" || typeof params.blockNumber !== "number") 
  {
    return "Invalid request."
  }

  const { blockNumber } = params
  const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)))

  if (blockNumber <= 0 || blockNumber > currentBlockNumber) 
  {
    return "Invalid block number."
  } 
  else 
  {
    const block = await blockDB.get(blockNumber.toString())

    return { block }
  }
}

async function getBlockTxnCountByHash(params, blockDB) 
{
  if (typeof params !== "object" || typeof params._hash !== "string") 
  {
    return "Invalid request."
  }

  const { _hash } = params
  const hashes = await bhashDB.keys.all()
  
  if (!hashes.includes(_hash)) 
  {
    return "Invalid block hash."
  }
  
  const blockNumber = await bhashDB.get(_hash)
  const block = await blockDB.get(blockNumber)
  
  return { count: block.transactions.length }
}

// Returns the number of transactions in the block with the specified block number
async function getBlockTxnCountByNumber(params, blockDB) 
{
  const { blockNumber } = params

  if (typeof params !== "object" || typeof blockNumber !== "number") 
  {
    return "Invalid request."
  } 
  else 
  {
    const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map((key) => parseInt(key)))
    if (blockNumber <= 0 || blockNumber > currentBlockNumber) 
    {
      return "Invalid block number."
    } 
    else 
    {
      const block = await blockDB.get(blockNumber.toString())
      return { count: block.transactions.length }
    }
  }
}



// Returns the balance of the account with the specified address.
async function getBalance(params, stateDB) 
{
  if 
  (
    typeof params !== "object" ||
    typeof params.address !== "string" ||
    !(await stateDB.keys().all()).includes(params.address)
  ) 
  {
    return "Invalid request."
  }
  const targetState = await stateDB.get(params.address)
  const targetBalance = targetState.balance
  return { balance: targetBalance }
}


async function getCode(params, codeDB) 
{
  const { codeHash } = params

  if 
  (
    typeof params !== "object" ||
    typeof codeHash !== "string" ||
    !(await codeDB.keys().all()).includes(codeHash)
  ) 
  {
    return "Invalid request."
  } 
  else 
  {
    return { code: await codeDB.get(codeHash) }
  }
}



async function getCodeHash(params, stateDB)
{
    const {address} = params
    if 
    (
        typeof params !== "object" ||
        typeof address !== "string" ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request."
    } 
    else 
    {
        const dataFromTarget = await stateDB.get(address) // Fetch target's state object
        return { codeHash: dataFromTarget.codeHash }
    }
}

async function getStorage(params, stateDB)
{
    const {address, key} = params
    if 
    (
        typeof params !== "object"     ||
        typeof address !== "string"    ||
        typeof key !== "string"        ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request."
    } 

    else 
    {
        const storageDB = new Level(__dirname + "/../log/accountStore/" + contractInfo.address)
        return { storage: await storageDB.get(key) }
        storageDB.close()
    }
}


async function getStorageKeys(params, stateDB)
{
    const {address} = params
    if 
    (
        typeof address !== "string"    ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request."
    } 
    else 
    {
        const storageDB = new Level(__dirname + "/../log/accountStore/" + contractInfo.address)
        return { storage: await storageDB.keys().all() }
    }
}


async function getStorageRoot(params, stateDB)
{
    const {address} = params
    if 
    (
        typeof address !== "string"    ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request."
    } 
    else 
    {
      return { storageRoot: (await stateDB.get(contractInfo.address)).storageRoot }
    }
}

async function getTxnByBlockNumberAndIndex(params, blockDB)
{
    const {index, blockNumber} = params
    if 
    (
        typeof params !== "object" ||
        typeof blockNumber !== "number" ||
        typeof index !== "number"
    ) 
    {
      return "Invalid request."
    } 
    else 
    {
      const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)))
      if (blockNumber <= 0 || blockNumber > currentBlockNumber) 
      {
        return "Invalid block number."
      } 

      else 
      {
        const block = await blockDB.get(blockNumber.toString())
        if (index < 0 || index >= block.transactions.length) 
        {
            return "Invalid transaction index."
        } 
        else 
        {
            return { transaction: block.transactions[index] }
        }
      }
    }

}

async function getTxnByBlockHashAndIndex(params, bhashDB)
{
  const {_hash, index} = params
  if 
  (
      typeof params !== "object" ||
      typeof _hash !== "string" ||
      typeof index !== "number"
  ) 
  {
    return "Invalid request."
  } 

  else 
  {
    const hashes = (await bhashDB.keys().all())
    if (!hashes.find(hash => hash === _hash)) 
    {
      return "Invalid block hash."
    } 
    else 
    {
      const blockNumber = await bhashDB.get(_hash)
      const block = await blockDB.get(blockNumber)
      if (index < 0 || index >= block.transactions.length) 
      {
        return "Invalid transaction index."
      } 

      else 
      {
        return { transaction: block.transactions[index] }
      }
    }
  }
}

async function sendTxn(params, transactionHandler) 
{
  const { transaction } = params
  if 
  (
    typeof params !== "object" ||
    typeof transaction !== "object"
  ) 
  {
    return "Invalid request."
  } 
  else 
  {
    try 
    {
      await transactionHandler(transaction)
      return { message: "Transaction received." }
    } 
    catch (error) 
    {
      console.error(error)
      return "Error processing transaction."
    }
  }
}


async function signTxn(params, keyPair) 
{
    const { transaction } = params
    if 
    (
      typeof params !== "object" ||
      typeof transaction !== "object"
    ) 
    {
      return "Invalid request."
    } 
    else 
    {
      Transaction.sign(transaction, keyPair)
      return { transaction }
    }
}


function rpc(PORT, client, transactionHandler, keyPair, stateDB, blockDB, bhashDB, codeDB) 
{
  const handleJsonRpcRequest = async (request, reply) => 
  {
    const { method, params, id } = request.body
    const generateResponse = (result, id) =>
    {
      return { jsonrpc: '2.0', data: result, id: id }
    }

    let result
    switch (method) {
      case 'getBlockNumber':
        result = await getBlockNumber(blockDB)
        break

      case 'getAddress':
        result = getAddress(client)
        break

      case 'getWork':
        result = await getWork(blockDB)
        break

      case 'mining':
        result = mining(client)
        break

      case 'getBlockByHash':
        result = await getBlockByHash(params, bhashDB, blockDB)
        break

      case 'getBlockByNumber':
        result = await getBlockByNumber(params, blockDB)
        break

      case 'getBlockTxnCountByHash':
        result = await getBlockTxnCountByHash(params, blockDB)
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
        result = await sendTxn(params, transactionHandler)
        break

      case 'signTxn':
        result = await signTxn(params, keyPair)
        break

      default:
        result = 'Method not found.'
    }
    return generateResponse(result, id)
  }

  fastify.post('/jsonrpc', async (request, reply) => 
  {
  try 
  {
    const response = await handleJsonRpcRequest(request, reply)
    return {response}
  }
  catch (error) 
  {
    return {error: {code: -32000, message: 'JSON-RPC error: ' + error.message}}
  }
  })

  // Start the server
  fastify.listen({ port: PORT }, (err) => 
  {
    if (err) 
    {
      console.error(err)
      process.exit(1)
    }
  })
}


module.exports = rpc