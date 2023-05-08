const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Transaction = require("../core/transaction");
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
    return data.response;

  } catch (error) {
    fastify.log.error(error);
  }
}


async function main()
{
  let params;
  //get the latest block
  let response = await callJsonrpc('getWork', params);

  params = {
    _hash: response.data.hash
  };
  await callJsonrpc('getBlockByHash', params);
}

main();

