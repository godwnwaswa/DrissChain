/**
 * Implements a server for an RPC (Remote Procedure Call) interface. The server exposes a set of functions 
 * that can be called remotely by a client that connects to it through the internet.
 * 
 * 
 * The server is implemented using the fastify framework, which is a lightweight and highly performant web 
 * framework for Node.js.
 * 
 * 
 * ----------------------------------------------------------------------------------------------------------------------
 * The `rpc` function creates an instance of the fastify server, defines several routes, and handles the requests 
 * that come through those routes. Specifically, there are four routes defined using the `fastify.get` and `fastify.post` 
 * methods, which handle requests with GET and POST HTTP methods, respectively. 
 * ----------------------------------------------------------------------------------------------------------------------
 * 
 * 
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * The routes handle different types of requests, which correspond to the different functions that can be called remotely by a client. 
 * These functions include:
 * 
 * a. `getBlockNumber`: Returns the number of the latest block in the blockchain.
 * b. `getAddress`: Returns the public key of the client that is connected to the server.
 * c. `getWork`: Returns the hash and nonce of the latest block in the blockchain.
 * d. `mining`: Returns a boolean value indicating whether the client is currently mining.
 * e. `getBlockByHash`: Returns the block with the specified hash.
 * f. `getBlockByNumber`: Returns the block with the specified block number.
 * g. `getBlockTxnCountByHash`: Returns the number of transactions in the block with the specified hash.
 * h. `getBlockTxnCountByNumber`: Returns the number of transactions in the block with the specified block number.
 * i. `getBalance`: Returns the balance of the account with the specified address.
 * j. `getCode`: Returns the code of the contract with the specified code hash.
 * k. `getCodeHash`: Returns the code hash of the contract deployed at the specified address.
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * requires -- PORT, client, transactionHandler, keyPair, stateDB, blockDB, bhashDB, codeDB
 * */
"use strict";

const Transaction = require("../core/transaction");

const fastify = require('fastify')();

// Returns the block with the specified hash.
async function getBlockByHash(params) {
  if (typeof params !== "object" || typeof params._hash !== "string") {
    return "Invalid request.";
  }

  const { _hash } = params;
  const hashes = await bhashDB.keys.all();
  
  if (!hashes.includes(_hash)) {
    return "Invalid block hash.";
  }
  
  const blockNumber = await bhashDB.get(_hash);
  const block = await blockDB.get(blockNumber);
  
  return { block };
}


// Returns the block with the specified block number
async function getBlockByNumber(params) {
  if (typeof params !== "object" || typeof params.blockNumber !== "number") {
    return "Invalid request.";
  }

  const { blockNumber } = params;
  const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)));

  if (blockNumber <= 0 || blockNumber > currentBlockNumber) {
    return "Invalid block number.";
  } else {
    const block = await blockDB.get(blockNumber.toString());

    return { block };
  }
}



// Returns the number of transactions in the block with the specified hash.
async function getBlockTxnCountByHash(params) {
  if (typeof params !== "object" || typeof params._hash !== "string") {
    return "Invalid request.";
  }

  const { _hash } = params;
  const hashes = await bhashDB.keys.all();
  
  if (!hashes.includes(_hash)) {
    return "Invalid block hash.";
  }
  
  const blockNumber = await bhashDB.get(_hash);
  const block = await blockDB.get(blockNumber);
  
  return { count: block.transactions.length };
}

// Returns the number of transactions in the block with the specified block number
async function getBlockTxnCountByNumber(params) {
  const { blockNumber } = params;

  if (typeof params !== "object" || typeof blockNumber !== "number") {
    return "Invalid request.";
  } else {
    const currentBlockNumber = Math.max(
      ...(await blockDB.keys().all()).map((key) => parseInt(key))
    );
    if (blockNumber <= 0 || blockNumber > currentBlockNumber) {
      return "Invalid block number.";
    } else {
      const block = await blockDB.get(blockNumber.toString());
      return { count: block.transactions.length };
    }
  }
}



// Returns the balance of the account with the specified address.
async function getBalance(params) {
  if (
    typeof params !== "object" ||
    typeof params.address !== "string" ||
    !(await stateDB.keys().all()).includes(params.address)
  ) {
    return "Invalid request.";
  }

  const targetState = await stateDB.get(params.address);
  const targetBalance = targetState.balance;

  return { balance: targetBalance };
}


async function getCode(params) {
  const { codeHash } = params;

  if (
    typeof params !== "object" ||
    typeof codeHash !== "string" ||
    !(await codeDB.keys().all()).includes(codeHash)
  ) {
    return "Invalid request.";
  } else {
    return { code: await codeDB.get(codeHash) };
  }
}



async function getCodeHash(params)
{
    const {address} = params;
    if (
        typeof params !== "object" ||
        typeof address !== "string" ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request.";
    } 

    else 
    {
        const dataFromTarget = await stateDB.get(address); // Fetch target's state object
        return { codeHash: dataFromTarget.codeHash };
    }
}

async function getStorage(params)
{
    const {address, key} = params;
    if (
        typeof params !== "object"     ||
        typeof address !== "string"    ||
        typeof key !== "string"        ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request.";
    } 

    else 
    {
        const storageDB = new Level(__dirname + "/../log/accountStore/" + contractInfo.address);
        return { storage: await storageDB.get(key) };
        storageDB.close();
    }
}


async function getStorageKeys(params)
{
    const {address} = params;
    if (
        typeof address !== "string"    ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request.";
    } 

    else 
    {
        const storageDB = new Level(__dirname + "/../log/accountStore/" + contractInfo.address);
        return { storage: await storageDB.keys().all() };
    }
}


async function getStorageRoot(params)
{
    const {address} = params;
    if (
        typeof address !== "string"    ||
        !(await stateDB.keys().all()).includes(address)
    ) 
    {
        return "Invalid request.";
    } 

    else 
    {
        return { storageRoot: (await stateDB.get(contractInfo.address)).storageRoot };
    }
}

async function getTxnByBlockNumberAndIndex(params)
{
    const {index, blockNumber} = params;
    if (
        typeof params !== "object" ||
        typeof blockNumber !== "number" ||
        typeof index !== "number"
    ) 
    {
        return "Invalid request.";
    } 
    else 
    {
        const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key)));
        if (blockNumber <= 0 || blockNumber > currentBlockNumber) 
        {
            return "Invalid block number.";
        } 

        else 
        {
            const block = await blockDB.get(blockNumber.toString());
            if (index < 0 || index >= block.transactions.length) 
            {
                return "Invalid transaction index.";
            } 

            else 
            {
                return { transaction: block.transactions[index] };
            }
        }
    }

}

async function getTxnByBlockHashAndIndex(params)
{
    const {_hash, index} = params;
    if (
        typeof params !== "object" ||
        typeof _hash !== "string" ||
        typeof index !== "number"
    ) 
    {
        return "Invalid request.";
    } 

    else 
    {
        const hashes = (await bhashDB.keys().all());
        if (!hashes.find(hash => hash === _hash)) 
        {
            return "Invalid block hash.";
        } 

        else 
        {
            const blockNumber = await bhashDB.get(_hash);
            const block = await blockDB.get(blockNumber);
            if (index < 0 || index >= block.transactions.length) 
            {
                return "Invalid transaction index.";
            } 

            else 
            {
                return { transaction: block.transactions[index] };
            }
        }
    }
}

async function sendTxn(params) {
  const { transaction } = params;
  if (
    typeof params !== "object" ||
    typeof transaction !== "object"
  ) {
    return "Invalid request.";
  } else {
    try {
      await transactionHandler(transaction);
      return { message: "Transaction received." };
    } catch (error) {
      console.error(error);
      return "Error processing transaction.";
    }
  }
}


async function signTxn(params) {
    const { transaction } = params;
    if (
        typeof params !== "object" ||
        typeof transaction !== "object"
    ) 
    {
        return "Invalid request.";
    } 

    else 
    {
        Transaction.sign(transaction, keyPair);
        return { transaction };
    }
}



//handles incoming JSON-RPC requests
async function handleJsonRpcRequest(request, reply) {
  const { method, params, id } = request.body;

  function generateResponse(result, id)
  {
    return { jsonrpc: '2.0', result, id };
  }

  let result;

  switch (method) {
    case 'getBlockNumber':
      result = getBlockByHash(params);
      break;

    case 'getAddress':
      result = { address: client.publicKey };
      break;

    case 'getWork':
      const latestBlock = await blockDB.get(Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))).toString());
      result = { hash: latestBlock.hash, nonce: latestBlock.nonce };
      break;

    case 'mining':
      result = { mining: client.mining };
      break;

    case 'getBlockByHash':
      result = getBlockByHash(params);
      break;

    case 'getBlockByNumber':
      result = getBlockByNumber(params);
      break;

    case 'getBlockTxnCountByHash':
      result = getBlockTxnCountByHash(params);
      break;

    case 'getBlockTxnCountByNumber':
      result = getBlockTxnCountByNumber(params);
      break;

    case 'getBalance':
      result = getBalance(params);
      break;

    case 'getCode':
      result = getCode(params);
      break;

    case 'getCodeHash':
      result = getCodeHash(params);
      break;

    case 'getStorage':
      result = getStorage(params);
      break;

    case 'getStorageKeys':
      result = getStorageKeys(params);
      break;

    case 'getStorageRoot':
      result = getStorageRoot(params);
      break;

    case 'getTxnByBlockNumberAndIndex':
      result = getTxnByBlockNumberAndIndex(params);
      break;

    case 'getTxnByBlockHashAndIndex':
      result = getTxnByBlockHashAndIndex(params);
      break;

    case 'sendTxn':
      result = sendTxn(params);
      break;

    case 'signTxn':
      result = signTxn(params);
      break;

    default:
      const error = { code: 404, message: 'Method not found.', id };
      throw error;
  }

  const response = generateResponse(result, id);
  return response;
}


function rpc(PORT, client, transactionHandler, keyPair, stateDB, blockDB, bhashDB, codeDB)
{
    //a route for the JSON-RPC post endpoint
    fastify.post('/jsonrpc', async (request, reply) => {
      try {
        const response = await handleJsonRpcRequest(request, reply);
        return response;
      } catch (error) {
        return error;
      }
    });

    //a route for the JSON-RPC post endpoint
    fastify.get('/jsonrpc', async (request, reply) => {
      try {
        const response = await handleJsonRpcRequest(request, reply);
        return response;
      } catch (error) {
        return error;
      }
    });

    // start the server
    fastify.listen({ port: PORT }, (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      
      console.log(`Server listening on http://localhost:${PORT}`);
    });

}

module.exports = rpc