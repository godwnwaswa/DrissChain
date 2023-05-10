const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Transaction = require("../core/transaction");
const EC = require("elliptic").ec, ec = new EC("secp256k1")
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")


async function callRPC(method, params = null) {
    const url = 'http://localhost:3000/jsonrpc';
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
      });
  
      const result = await response.json();
      return result.response.data;
  
    } catch (error) {
      return error
    }
  }

const getBlockNumber = async (req, reply) => {
    reply.send(await callRPC('getBlockNumber'))
}

const getItem = (req, reply) => {
    const { id } = req.params
    const item = items.find(item => item.id == id)
    reply.send(item)
}


const addItem = (req, reply) => {

    const item = req.body

    items = [...items, item]

    reply.code(201).send(item)
}

const deleteItem = (req, reply) => {
    const {id} = req.params

    items = items.filter( item => item.id != id)

    reply.send({message: `Item ${id} has been deleted`})
}

const updateItem = (req, reply) => {
    const {id} = req.params
    const {name} = req.body
    items = items.map(item => (item.id == id ? {id, name} : item))
    item = items.find(item => item.id == id)
    reply.send(item)
}

module.exports = { getBlockNumber, getItem, addItem, updateItem, deleteItem}