# JSON-RPC APIs

## What are JSON-RPC APIs?

JSON-RPC APIs are APIs provided by running a JeChain RPC server. They can be used by apps or additional tools to interact with the node, thus also getting access to the network, being able to send transactions from the app and getting the pieces of blockchain data like blocks, account balance and more.


## APIs

### GET

* `/getBlockNumber`:
    * Use case: Get the latest block number.
    * Reply body: `{ success: true, payload: { blockNumber: <block_number> } }`

* `/getAddress`:
    * Use case: Get the JeChain address from the RPC server.
    * Reply body: `{ success: true, payload: { address: <address> } }`

* `/getWork`:
    * Use case: Get hash and nonce from the latest block.
    * Reply body: `{ success: true, payload: { hash: <hash>, nonce: <nonce> } }`

* `/mining`:
    * Use case: Check on whether client is mining or not.
    * Reply body: `{ success: true, payload: { mining: true | false } }`

### POST

* `/getBlockByHash`:
    * Use case: Get block by hash.
    * Request body: `{ params: { hash: <hash> } }`
    * Reply body: `{ success: true, payload: { block: <block> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`
        * Invalid block hash (block with given hash not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid block hash." } }`

* `/getBlockByNumber`:
    * Use case: Get block by block number.
    * Request body: `{ params: { blockNumber: <block_number> } }`
    * Reply body: `{ success: true, payload: { block: <block> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`
        * Invalid block number (block with given number not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid block number." } }`

* `/getBlockTxnCountByHash`:
    * Use case: Get transaction count from block through block hash.
    * Request body: `{ params: { hash: <hash> } }`
    * Reply body: `{ success: true, payload: { count: <count> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`
        * Invalid block hash (block with given hash not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid block hash." } }`

* `/getBlockTxnCountByNumber`:
    * Use case: Get transaction count from block through block number.
    * Request body: `{ params: { blockNumber: <block_number> } }`
    * Reply body: `{ success: true, payload: { count: <count> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`
        * Invalid block number (block with given number not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid block number." } }`

* `/getBalance`:
    * Use case: Get balance from address.
    * Request body: `{ params: { address: <address> } }`
    * Reply body: `{ success: true, payload: { balance: <balance> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`

* `/getCode`:
    * Use case: Get code from address.
    * Request body: `{ params: { address: <address> } }`
    * Reply body: `{ success: true, payload: { code: <code> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`

* `/getStorage`:
    * Use case: Get the storage object from address.
    * Request body: `{ params: { address: <address> } }`
    * Reply body: `{ success: true, payload: { storage: <storage_object> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`

* `/sendTxn`:
    * Use case: Send transaction.
    * Request body: `{ params: { transaction: <transaction_object> } }`
    * Reply body: `{ success: true, payload: { message: "tx received." } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`

* `/getTxnByBlockHashAndIndex`:
    * Use case: Get transaction through block hash and transaction index.
    * Request body: `{ params: { hash: <hash>, index: <index> } }`
    * Reply body: `{ success: true, payload: { transaction: <transaction_object> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`
        * Invalid block hash (block with given hash not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid block hash." } }`
        * Invalid transaction index (transaction with index given not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid transaction index." } }`

* `/getTxnByBlockNumberAndIndex`:
    * Use case: Get transaction through block number and transaction index.
    * Request body: `{ params: { blockNumber: <block_number>, index: <index> } }`
    * Reply body: `{ success: true, payload: { transaction: <transaction_object> } }`
    * Error body:
        * Invalid request (not enough params):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid request." } }`
        * Invalid block number (block with given number not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid block number." } }`
        * Invalid transaction index (transaction with index given not found):
            * Status: 400
            * Body: `{ success: false, payload: null, error: { message: "Invalid transaction index." } }`

### Other errors

* Invalid option (non-existent API):
    * Status: 404
    * Body: `{ success: false, payload: null, error: { message: "Invalid option." } }`
