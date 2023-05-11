const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))
const Transaction = require("../../core/transaction")
const EC = require("elliptic").ec, ec = new EC("secp256k1")
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")


const callRPC = async (method, params = null) => {
    const url = 'http://localhost:3000/jsonrpc'
    const payload = {
      "jsonrpc": "2.0",
      "method": method,
      "params": params,
      "id": 1
    }
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await response.json()
      return result.response.data
  
    } 
    catch (error) 
    {
      return error
    }
  }
  
const getRPC = (method) => async (req, reply) => {
  const result = await callRPC(method, req.params || req.body)
  reply.send(result)
}

const postRPC = (method) => async (req, reply) => {
  const result = await callRPC(method, req.body)
  reply.send(result)
}

const getBlockNumber = getRPC('getBlockNumber')
const getAddress = getRPC('getAddress')
const getWork = getRPC('getWork')
const getMining = getRPC('getMining')
const getBlockByHash = getRPC('getBlockByHash')
const getBlockByNumber = getRPC('getBlockByNumber')
const getBlockTxnCountByHash = getRPC('getBlockTxnCountByHash')
const getBlockTxnCountByNumber = getRPC('getBlockTxnCountByNumber')
const getBalance = postRPC('getBalance')
const getCode = getRPC('getCode')
const getCodeHash = getRPC('getCodeHash')
const getStorage = postRPC('getStorage')
const getStorageRoot = getRPC('getStorageRoot')
const getStorageKeys = getRPC('getStorageKeys')
const getTxnByBlockNumberAndIndex = getRPC('getTxnByBlockNumberAndIndex')
const getTxnByBlockHashAndIndex = getRPC('getTxnByBlockHashAndIndex')
const signTxn = postRPC('signTxn')
const sendTxn = postRPC('sendTxn')


module.exports = 
{ 
  getBlockNumber, 
  getAddress, 
  getWork, 
  getMining, 
  getBlockByHash, 
  getBlockByNumber,
  getBlockTxnCountByHash,
  getBlockTxnCountByNumber,
  getBalance,
  getCode,
  getCodeHash,
  getStorage,
  getStorageKeys,
  getStorageRoot,
  getTxnByBlockNumberAndIndex,
  getTxnByBlockHashAndIndex,
  signTxn,
  sendTxn,
}