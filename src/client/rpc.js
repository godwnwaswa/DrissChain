const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Transaction = require("../core/transaction");
const EC = require("elliptic").ec, ec = new EC("secp256k1")
const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")

const pino = require('pino');
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'pid,hostname',
    },
  },
});
const fastify = require('fastify')({
  logger : logger
});

async function callJsonrpc(method, params = null) {
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

    const data = await response.json();
    fastify.log.info(data.response);
    return data.response.data;

  } catch (error) {
    fastify.log.error(error);
  }
}

const privateKey = "266c92b71cdd7a80323ae5bfccbabd14477d35acc32236ce98a0b234a74b437a"
const keyPair = ec.keyFromPrivate(privateKey, "hex")
const publicKey = keyPair.getPublic("hex")
const publicAddress = SHA256(publicKey)

const privateKey1 = "87591526c841c5a570e3310540f53d1d85bed3c90476730a97de93b57accf439"
const keyPair1 = ec.keyFromPrivate(privateKey1, "hex")
const publicKey1 = keyPair.getPublic("hex")
const publicAddress1 = SHA256(publicKey1)

async function main()
{
  let params;

  // params = {
  //   transaction: new Transaction(publicAddress1, 3000)
  // };

  // params = {
  //   transaction: await callJsonrpc('signTxn', params)
  // };


  // await callJsonrpc('sendTxn', params);

  // let work = await callJsonrpc('getWork');

  // params = {
  //   _hash: work.hash
  // };
  await callJsonrpc('getBlockNumber');
}

main();

