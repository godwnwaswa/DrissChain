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

const getBlockNumber = async (req, reply) => reply.send(await callRPC('getBlockNumber'))
const getAddress = async (req, reply) => reply.send(await callRPC('getAddress'))
const getWork = async (req, reply) => reply.send(await callRPC('getWork'))
const getMining = async (req, reply) => reply.send(await callRPC('getMining'))
const getBlockByHash = async (req, reply) => reply.send(await callRPC('getBlockByHash', req.params))
const getBlockByNumber = async (req, reply) => reply.send(await callRPC('getBlockByNumber', req.params))
const getBlockTxnCountByHash = async (req, reply) => reply.send(await callRPC('getBlockTxnCountByHash', req.params))
const getBlockTxnCountByNumber = async (req, reply) => reply.send(await callRPC('getBlockTxnCountByNumber', req.params))
const getBalance = async (req, reply) => reply.send(await callRPC('getBalance', req.body))

module.exports = 
{ getBlockNumber, 
  getAddress, 
  getWork, 
  getMining, 
  getBlockByHash, 
  getBlockByNumber,
  getBlockTxnCountByHash,
  getBlockTxnCountByNumber,
  getBalance
}