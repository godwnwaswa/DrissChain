"use strict";

const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const WS = require("ws");
const EC = require("elliptic").ec, ec = new EC("secp256k1");
const { Level } = require('level');
const { fork } = require("child_process");

const Block = require("../core/block");
const Transaction = require("../core/transaction");
const changeState = require("../core/state");
const { BLOCK_REWARD, BLOCK_GAS_LIMIT, EMPTY_HASH, INITIAL_SUPPLY, FIRST_ACCOUNT } = require("../config.json");
const { produceMessage, sendMessage } = require("./message");
const generateGenesisBlock = require("../core/genesis");
const { addTransaction, clearDepreciatedTxns }= require("../core/txPool");
const rpc = require("../rpc/rpc");
const TYPE = require("./message-types");
const { verifyBlock, updateDifficulty } = require("../consensus/consensus");
const { parseJSON, indexTxns } = require("../utils/utils");
const jelscript = require("../core/runtime");
const { buildMerkleTree } = require("../core/merkle");

const opened    = [];  // Addresses and sockets from connected nodes.
const connected = [];  // Addresses from connected nodes.
let connectedNodes = 0;

let worker = fork(`${__dirname}/../miner/worker.js`); // Worker thread (for PoW mining).
let mined = false; // This will be used to inform the node that another node has already mined before it.


// Some chain info cache
const chainInfo = {
    transactionPool: [],
    latestBlock: generateGenesisBlock(), 
    latestSyncBlock: null,
    checkedBlock: {},
    tempStates: {},
    difficulty: 1
};

const stateDB = new Level(__dirname + "/../log/stateStore", { valueEncoding: "json" });
const blockDB = new Level(__dirname + "/../log/blockStore", { valueEncoding: "json" });
const bhashDB = new Level(__dirname + "/../log/bhashStore");
const codeDB = new Level(__dirname + "/../log/codeStore");


/**
 * ------------------------------------------------------------------------------------------------------------------------------------
 * Starts a WebSocket server with some configuration options. 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * WebSocket is a protocol that enables real-time, two-way communication between the server and client. This function is used to 
 * implement a peer-to-peer (P2P) network of nodes in a blockchain application.The P2P network consists of nodes that communicate with 
 * each other, share the latest blockchain data, validate transactions, and  mine new blocks.
 * ------------------------------------------------------------------------------------------------------------------------------------
 * 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * a. `PORT`: The port number on which the WebSocket server will listen. Default is 3000.
 * b. `RPC_PORT`: The port number on which the RPC server will listen. Default is 5000.
 * c. `PEERS`: An array of WebSocket addresses of other nodes to connect to.
 * d. `MAX_PEERS`: The maximum number of peers that can be connected at the same time. Default is 10.
 * e. `MY_ADDRESS`: The WebSocket address of the current node. Default is `ws://localhost:3000`.
 * f. `ENABLE_MINING`: A boolean flag indicating whether mining is enabled or not. Default is false.
 * g. `ENABLE_LOGGING`: A boolean flag indicating whether logging is enabled or not. Default is false.
 * h. `ENABLE_RPC`: A boolean flag indicating whether the RPC server is enabled or not. Default is false.
 * i. `ENABLE_CHAIN_REQUEST`: A boolean flag indicating whether the node is syncing with the blockchain or not. Default is false.
 * ------------------------------------------------------------------------------------------------------------------------------------
 * 
 * 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * Generates a private key, a key pair, and a public key using the elliptic curve cryptography (EC) library. It sets 
 * up an error handler to catch any uncaught exceptions and logs them to the console. It also stores an empty string with an empty hash
 * in the code database.
 * ------------------------------------------------------------------------------------------------------------------------------------
 * 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * Creates a WebSocket server using the `ws` library, listens on the specified port, and logs a message to the console indicating that 
 * the server is listening. It then sets up a connection event handler for the server. When a client connects to the server, the 
 * connection event is emitted, and the handler function is executed. 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * Inside the connection event handler, the function sets up a message event handler for the socket, which listens for incoming 
 * messages. When a message is received, it is parsed from binary to JSON format using the `parseJSON` function. The parsed message is 
 * then processed based on its `type` property.
 * ------------------------------------------------------------------------------------------------------------------------------------
 * 
 * 
 * ------------------------------------------------------------------------------------------------------------------------------------
 * There are 3 message types handled in the function:
 * 
 * 1. `TYPE.NEW_BLOCK`: 
 * 
 * This message is sent when a new block is received by a node. The function checks if the block's parent hash is the same as the latest 
 * block's hash. If it is, the block is discarded as a duplicate. If it is not, the function verifies the block using the `verifyBlock` 
 * function and updates the blockchain, transaction pool, and chain info if the block is valid. If mining is enabled, the mined flag is 
 * set to true, and the worker thread is killed and restarted. Finally, the block is broadcast to other nodes using the `sendMessage` 
 * function.
 * 
 * 
 * 2. `TYPE.CREATE_TRANSACTION`: 
 * 
 * This message is sent when a new transaction is received by a node. The function verifies the transaction using the `Transaction.isValid` 
 * function and adds it to the transaction pool. The transaction is then broadcast to other nodes using the `sendMessage` function.
 * 
 * 3. `TYPE.REQUEST`: 
 * 
 * This message is sent when a node requests blockchain data from another node. The function sends the requested data 
 * back to the requester using the `sendMessage` function.
 * ----------------------------------------------------------------------------------------------------------------------------------------
 * 
 * --------------------------------------------------------------------------------------------------------------------------------------
 * The function ends with no return statement, as it is an asynchronous function that starts a server and waits for incoming connections 
 * and messages.
 * --------------------------------------------------------------------------------------------------------------------------------------
 * 
 * */
async function startServer(options) {
    const PORT                 = options.PORT || 3000;                        
    const RPC_PORT             = options.RPC_PORT || 5000;                    
    const PEERS                = options.PEERS || [];                         
    const MAX_PEERS            = options.MAX_PEERS || 10                      
    const MY_ADDRESS           = options.MY_ADDRESS || "ws://localhost:3000"; 
    const ENABLE_MINING        = options.ENABLE_MINING ? true : false;        
    const ENABLE_LOGGING       = options.ENABLE_LOGGING ? true : false;       
    const ENABLE_RPC           = options.ENABLE_RPC ? true : false;           
    let   ENABLE_CHAIN_REQUEST = options.ENABLE_CHAIN_REQUEST ? true : false; 

    const privateKey = options.PRIVATE_KEY || ec.genKeyPair().getPrivate("hex");
    const keyPair = ec.keyFromPrivate(privateKey, "hex");
    const publicKey = keyPair.getPublic("hex");

    process.on("uncaughtException", err => console.log("LOG ::", err));

    await codeDB.put(EMPTY_HASH, "");

    const server = new WS.Server({ port: PORT });

    console.log("LOG :: Listening on PORT", PORT.toString());

    server.on("connection", async (socket, req) => {
        // Message handler
        socket.on("message", async message => {
            const _message = parseJSON(message); // Parse binary message to JSON

            switch (_message.type) {
                // Below are handlers for every message types.

                case TYPE.NEW_BLOCK:
                    // "TYPE.NEW_BLOCK" is sent when someone wants to submit a new block.
                    // Its message body must contain the new block and the new difficulty.

                    const newBlock = _message.data;

                    // We will only continue checking the block if its parentHash is not the same as the latest block's hash.
                    // This is because the block sent to us is likely duplicated or from a node that has lost and should be discarded.

                    if (!chainInfo.checkedBlock[newBlock.hash]) {
                        chainInfo.checkedBlock[newBlock.hash] = true;
                    } else { return; }

                    if (
                        newBlock.parentHash !== chainInfo.latestBlock.parentHash &&
                        (!ENABLE_CHAIN_REQUEST || (ENABLE_CHAIN_REQUEST && currentSyncBlock > 1))
                        // Only proceed if syncing is disabled or enabled but already synced at least the genesis block
                    ) {
                        chainInfo.checkedBlock[newBlock.hash] = true;

                        if (await verifyBlock(newBlock, chainInfo, stateDB, codeDB, ENABLE_LOGGING)) {
                            console.log("LOG :: New block received.");

                            // If mining is enabled, we will set mined to true, informing that another node has mined before us.
                            if (ENABLE_MINING) {
                                mined = true;

                                worker.kill(); // Stop the worker thread

                                worker = fork(`${__dirname}/../miner/worker.js`); // Renew
                            }

                            await updateDifficulty(newBlock, chainInfo, blockDB); // Update difficulty

                            await blockDB.put(newBlock.blockNumber.toString(), newBlock); // Add block to chain
                            await bhashDB.put(newBlock.hash, newBlock.blockNumber.toString()); // Assign block number to the matching block hash

                            chainInfo.latestBlock = newBlock; // Update chain info

                            // Update the new transaction pool (remove all the transactions that are no longer valid).
                            chainInfo.transactionPool = await clearDepreciatedTxns(chainInfo, stateDB);

                            console.log(`LOG :: Block #${newBlock.blockNumber} synced, state transited.`);

                            sendMessage(message, opened); // Broadcast block to other nodes

                            if (ENABLE_CHAIN_REQUEST) {
                                ENABLE_CHAIN_REQUEST = false;
                            }
                        }
                    }

                    break;
                
                case TYPE.CREATE_TRANSACTION:
                    if (ENABLE_CHAIN_REQUEST) break; // Unsynced nodes should not be able to proceed.

                    // TYPE.CREATE_TRANSACTION is sent when someone wants to submit a transaction.
                    // Its message body must contain a transaction.

                    // Weakly verify the transation, full verification is achieved in block production.

                    const transaction = _message.data;

                    if (!(await Transaction.isValid(transaction, stateDB))) break;

                    // Get public key and address from sender
                    const txSenderPubkey = Transaction.getPubKey(transaction);
                    const txSenderAddress = SHA256(txSenderPubkey);

                    if (!(await stateDB.keys().all()).includes(txSenderAddress)) break;

                    // After transaction is added, the transaction must be broadcasted to others since the sender might only send it to a few nodes.
    
                    // This is pretty much the same as addTransaction, but we will send the transaction to other connected nodes if it's valid.
    
                    // Check nonce
                    let maxNonce = 0;

                    for (const tx of chainInfo.transactionPool) {
                        const poolTxSenderPubkey = Transaction.getPubKey(transaction);
                        const poolTxSenderAddress = SHA256(poolTxSenderPubkey);

                        if (poolTxSenderAddress === txSenderAddress && tx.nonce > maxNonce) {
                            maxNonce = tx.nonce;
                        }
                    }

                    if (maxNonce + 1 !== transaction.nonce) return;

                    console.log("LOG :: New transaction received, broadcasted and added to pool.");

                    chainInfo.transactionPool.push(transaction);
                    
                    // Broadcast the transaction
                    sendMessage(message, opened);
    
                    break;

                case TYPE.REQUEST_BLOCK:
                    if (!ENABLE_CHAIN_REQUEST) { // Unsynced nodes should not be able to send blocks
                        const { blockNumber, requestAddress } = _message.data;

                        const socket = opened.find(node => node.address === requestAddress).socket; // Get socket from address

                        const currentBlockNumber = Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))); // Get latest block number

                        if (blockNumber > 0 && blockNumber <= currentBlockNumber) { // Check if block number is valid
                            const block = await blockDB.get( blockNumber.toString() ); // Get block

                            socket.send(produceMessage(TYPE.SEND_BLOCK, block)); // Send block
                        
                            console.log(`LOG :: Sent block at position ${blockNumber} to ${requestAddress}.`);
                        }
                    }
    
                    break;
                
                case TYPE.SEND_BLOCK:
                    const block = _message.data;

                    if (ENABLE_CHAIN_REQUEST && currentSyncBlock === block.blockNumber) {
                        if (
                            chainInfo.latestSyncBlock === null // If latest synced block is null then we immediately add the block into the chain without verification.
                            ||                                 // This happens due to the fact that the genesis block can discard every possible set rule ¯\_(ツ)_/¯
                            await verifyBlock(block, chainInfo, stateDB, codeDB, ENABLE_LOGGING)
                        ) {
                            currentSyncBlock += 1;

                            await blockDB.put(block.blockNumber.toString(), block); // Add block to chain.
                            await bhashDB.put(block.hash, block.blockNumber.toString()); // Assign block number to the matching block hash
                    
                            if (!chainInfo.latestSyncBlock) {
                                chainInfo.latestSyncBlock = block; // Update latest synced block.                                

                                await changeState(block, stateDB, codeDB, ENABLE_LOGGING); // Transit state
                            }

                            chainInfo.latestBlock = block; // Update latest block.

                            await updateDifficulty(block, chainInfo, blockDB); // Update difficulty.

                            console.log(`LOG :: Synced block at position ${block.blockNumber}.`);

                            // Continue requesting the next block
                            for (const node of opened) {
                                node.socket.send(
                                    produceMessage(
                                        TYPE.REQUEST_BLOCK,
                                        { blockNumber: currentSyncBlock, requestAddress: MY_ADDRESS }
                                    )
                                );

                                await new Promise(r => setTimeout(r, 5000)); // Delay for block verification
                            }
                        }
                    }

                    break;
                
                case TYPE.HANDSHAKE:
                    const address = _message.data;

                    if (connectedNodes <= MAX_PEERS) {
                        connect(MY_ADDRESS, address);
                    }
            }
        });
    });

    if (!ENABLE_CHAIN_REQUEST) {
        if ((await blockDB.keys().all()).length === 0) {
            // Initial state

            await stateDB.put(FIRST_ACCOUNT, { balance: INITIAL_SUPPLY, codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH });

            await blockDB.put(chainInfo.latestBlock.blockNumber.toString(), chainInfo.latestBlock);
            await bhashDB.put(chainInfo.latestBlock.hash, chainInfo.latestBlock.blockNumber.toString()); // Assign block number to the matching block hash
    
            await changeState(chainInfo.latestBlock, stateDB, codeDB);
        } else {
            chainInfo.latestBlock = await blockDB.get( Math.max(...(await blockDB.keys().all()).map(key => parseInt(key))).toString() );
            chainInfo.difficulty = chainInfo.latestBlock.difficulty;
        }
    }

    PEERS.forEach(peer => connect(MY_ADDRESS, peer)); // Connect to peerss

    // Sync chain
    let currentSyncBlock = 1;

    if (ENABLE_CHAIN_REQUEST) {
        const blockNumbers = await blockDB.keys().all();

        if (blockNumbers.length !== 0) {
            currentSyncBlock = Math.max(...blockNumbers.map(key => parseInt(key)));
        }

        if (currentSyncBlock === 1) {
            // Initial state

            await stateDB.put(FIRST_ACCOUNT, { balance: INITIAL_SUPPLY, codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH });
        }

        setTimeout(async () => {
            for (const node of opened) {
                node.socket.send(
                    produceMessage(
                        TYPE.REQUEST_BLOCK,
                        { blockNumber: currentSyncBlock, requestAddress: MY_ADDRESS }
                    )
                );

                await new Promise(r => setTimeout(r, 5000)); // Delay for block verification
            }
        }, 5000);
    }

    if (ENABLE_MINING) loopMine(publicKey, ENABLE_CHAIN_REQUEST, ENABLE_LOGGING);
    if (ENABLE_RPC) rpc(RPC_PORT, { publicKey, mining: ENABLE_MINING }, sendTransaction, keyPair, stateDB, blockDB, bhashDB, codeDB);
}

/**
 * Connects to a WebSocket server at the specified address.
 * 
 * */
function connect(MY_ADDRESS, address) {
    /**
     * Check if the `address` is not already in the `connected` array and if it is not equal to `MY_ADDRESS`.
     * 
     * */
    if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
        /**
         * Create a new WebSocket object with the specified `address`.
         * 
         * */
        const socket = new WS(address); 

        /**
         * Open a connection to the socket and send a handshake message to all connected nodes.
         * 
         * */
        socket.on("open", async () => {
            for (const _address of [MY_ADDRESS, ...connected]) socket.send(produceMessage(TYPE.HANDSHAKE, _address));
            for (const node of opened) node.socket.send(produceMessage(TYPE.HANDSHAKE, address));

            /**
             * Check if the `address` is not already in the `opened` array and if it is not equal to `MY_ADDRESS`.
             * This is to prevent address redundancy.
             * 
             * */
            if (!opened.find(peer => peer.address === address) && address !== MY_ADDRESS) {
                opened.push({ socket, address });
            }

            /**
             * Push the `address` into the `connected` array, increment the `connectedNodes` counter, 
             * and log a message to the console.
             * 
             * */
            if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
                connected.push(address);

                connectedNodes++;

                console.log(`LOG :: Connected to ${address}.`);

                /**
                 * Listen for the "close" event on the socket and remove the `address` from the `opened` and `connected` arrays.
                 * 
                 * The `indexOf` method is used to find the index of the `address` in the arrays, 
                 * and the `splice` method is used to remove it.
                 * 
                 * */
                socket.on("close", () => {
                    opened.splice(connected.indexOf(address), 1);
                    connected.splice(connected.indexOf(address), 1);

                    console.log(`LOG :: Disconnected from ${address}.`);
                });
            }
        });
    }

    /**
     * Return `true` to indicate that the connection was successful.
     * */
    return true;
}

// Function to broadcast a transaction.
async function sendTransaction(transaction) {
    sendMessage(produceMessage(TYPE.CREATE_TRANSACTION, transaction), opened);

    console.log("LOG :: Sent one transaction.");

    await addTransaction(transaction, chainInfo, stateDB);
}

async function mine(publicKey, ENABLE_LOGGING) {
    function mine(block, difficulty) {
        return new Promise((resolve, reject) => {
            worker.addListener("message", message => resolve(message.result));

            worker.send({ type: "MINE", data: [block, difficulty] }); // Send a message to the worker thread, asking it to mine.
        });
    }

    // Create a new block.
    const block = new Block(
        chainInfo.latestBlock.blockNumber + 1, 
        Date.now(), 
        [], // Will add transactions down here 
        chainInfo.difficulty, 
        chainInfo.latestBlock.hash,
        SHA256(publicKey)
    );

    // Collect a list of transactions to mine
    const transactionsToMine = [], states = {}, code = {}, storage = {}, skipped = {};
    let totalContractGas = 0n, totalTxGas = 0n;

    const existedAddresses = await stateDB.keys().all();

    for (const tx of chainInfo.transactionPool) {
        if (totalContractGas + BigInt(tx.additionalData.contractGas || 0) >= BigInt(BLOCK_GAS_LIMIT)) break;

        const txSenderPubkey = Transaction.getPubKey(tx);
        const txSenderAddress = SHA256(txSenderPubkey);

        if (skipped[txSenderAddress]) continue; // Check if transaction is from an ignored address.

        // Normal coin transfers
        if (!states[txSenderAddress]) {
            const senderState = await stateDB.get(txSenderAddress);

            states[txSenderAddress] = senderState;
            code[senderState.codeHash] = await codeDB.get(senderState.codeHash);

            if (senderState.codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true;
                continue;
            }
    
            states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString();
        } else {
            if (states[txSenderAddress].codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true;
                continue;
            }

            states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString();
        }

        if (!existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
            code[EMPTY_HASH] = "";
        }
    
        if (existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = await stateDB.get(tx.recipient);
            code[states[tx.recipient].codeHash] = await codeDB.get(states[tx.recipient].codeHash);
        }
    
        states[tx.recipient].balance = (BigInt(states[tx.recipient].balance) + BigInt(tx.amount)).toString();

        // Contract deployment
        if (
            states[txSenderAddress].codeHash === EMPTY_HASH &&
            typeof tx.additionalData.scBody === "string"
        ) {
            states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody);
            code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
        }

        // Update nonce
        states[txSenderAddress].nonce += 1;

        // Decide to drop or add transaction to block
        if (BigInt(states[txSenderAddress].balance) < 0n) {
            skipped[txSenderAddress] = true;
            continue;
        } else {
            transactionsToMine.push(tx);

            totalContractGas += BigInt(tx.additionalData.contractGas || 0);
            totalTxGas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0);
        }

        // Contract execution
        if (states[tx.recipient].codeHash !== EMPTY_HASH) {
            const contractInfo = { address: tx.recipient };
            
            const [ newState, newStorage ] = await jelscript(code[states[tx.recipient].codeHash], states, BigInt(tx.additionalData.contractGas || 0), stateDB, block, tx, contractInfo, false);

            for (const account of Object.keys(newState)) {
                states[account] = newState[account];

                storage[tx.recipient] = newStorage;
            }
        }
    }

    block.transactions = transactionsToMine; // Add transactions to block
    block.hash = Block.getHash(block); // Re-hash with new transactions
    block.txRoot = buildMerkleTree(indexTxns(block.transactions)).val; // Re-gen transaction root with new transactions

    // Mine the block.
    mine(block, chainInfo.difficulty)
        .then(async result => {
            // If the block is not mined before, we will add it to our chain and broadcast this new block.
            if (!mined) {
                await updateDifficulty(result, chainInfo, blockDB); // Update difficulty

                await blockDB.put(result.blockNumber.toString(), result); // Add block to chain
                await bhashDB.put(result.hash, result.blockNumber.toString()); // Assign block number to the matching block hash

                chainInfo.latestBlock = result; // Update chain info

                // Reward

                if (!existedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
                    code[EMPTY_HASH] = "";
                }
            
                if (existedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = await stateDB.get(result.coinbase);
                    code[states[result.coinbase].codeHash] = await codeDB.get(states[result.coinbase].codeHash);
                }

                let gas = 0n;

                for (const tx of result.transactions) { gas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0) }

                states[result.coinbase].balance = (BigInt(states[result.coinbase].balance) + BigInt(BLOCK_REWARD) + gas).toString();

                // Transit state
                for (const address in storage) {
                    const storageDB = new Level(__dirname + "/../log/accountStore/" + address);
                    const keys = Object.keys(storage[address]);
        
                    states[address].storageRoot = buildMerkleTree(keys.map(key => key + " " + storage[address][key])).val;
        
                    for (const key of keys) {
                        await storageDB.put(key, storage[address][key]);
                    }
        
                    await storageDB.close();
                }
        
                for (const account of Object.keys(states)) {
                    await stateDB.put(account, states[account]);
        
                    await codeDB.put(states[account].codeHash, code[states[account].codeHash]);
                }

                // Update the new transaction pool (remove all the transactions that are no longer valid).
                chainInfo.transactionPool = await clearDepreciatedTxns(chainInfo, stateDB);

                sendMessage(produceMessage(TYPE.NEW_BLOCK, chainInfo.latestBlock), opened); // Broadcast the new block

                console.log(`LOG :: Block #${chainInfo.latestBlock.blockNumber} mined and synced, state transited.`);
            } else {
                mined = false;
            }

            // Re-create the worker thread
            worker.kill();

            worker = fork(`${__dirname}/../miner/worker.js`);
        })
        .catch(err => console.log(err));
}

// Function to mine continuously
function loopMine(publicKey, ENABLE_CHAIN_REQUEST, ENABLE_LOGGING, time = 1000) {
    let length = chainInfo.latestBlock.blockNumber;
    let mining = true;

    setInterval(async () => {
        if (mining || length !== chainInfo.latestBlock.blockNumber) {
            mining = false;
            length = chainInfo.latestBlock.blockNumber;

            if (!ENABLE_CHAIN_REQUEST) await mine(publicKey, ENABLE_LOGGING);
        }
    }, time);
}

module.exports = { startServer };
