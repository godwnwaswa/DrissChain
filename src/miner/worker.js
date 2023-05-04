/**
 * This code defines a worker thread for a miner in a blockchain network.
 * */

"use strict";

const Block = require("../core/block");
const { log16 } = require("../utils/utils");

/**
 * 
 * -------------------------------------------------------------------------------------------------
 * The worker thread listens for messages from the main process and acts on the "MINE" message type. 
 * Upon receiving the message, it extracts the block and difficulty data from the message data.
 * -------------------------------------------------------------------------------------------------
 * 
 * -------------------------------------------------------------------------------------------------
 * The thread then starts a loop that incrementally increases the nonce value of the block and 
 * recalculates its hash until a hash with a specified number of leading zeros is obtained. 
 * The number of leading zeros required is calculated based on the difficulty parameter using 
 * the log16 function from the utils module.
 * -------------------------------------------------------------------------------------------------
 * 
 * -------------------------------------------------------------------------------------------------
 * Once a block with the required hash is found, the worker thread sends the result back to the main 
 * process using the send method of the process object.
 * -------------------------------------------------------------------------------------------------
 * 
 * 
 * */
process.on("message", message => {
    if (message.type === "MINE") {
        // When the "MINE" message is received, the thread should be mining by incrementing the nonce value until a preferable hash is met.

        const block = message.data[0];
        const difficulty = message.data[1];

        for (;;) {
            // We will loop until the hash has "5+difficulty" starting zeros.
            if (block.hash.startsWith("00000" + Array(Math.floor(log16(difficulty)) + 1).join("0"))) {
                process.send({ result: block });

                break;
            }
            
            block.nonce++;
            block.hash = Block.getHash(block);
        }
    }
});
