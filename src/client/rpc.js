const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Transaction = require("../core/transaction");

async function callJsonrpc(method, params) {
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
    console.log(data.response);
  } catch (error) {
    console.error(error);
  }
}

// Example usage:
async function main()
{
  const params = {
    blockNumber: 200
  };
  await callJsonrpc('getBlockByNumber', params);
}

main();

