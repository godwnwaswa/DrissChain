"use strict";

const Block = require("../core/block");
const { log16 } = require("../utils/utils");

/**
 * A worker thread for a miner in the Drisschain network.
 * */
process.on("message", message => {
    if (message.type === "MINE") {
        const block = message.data[0];
        const difficulty = message.data[1];

        for (;;) {
            if (block.hash.startsWith("00000" + Array(Math.floor(log16(difficulty)) + 1).join("0"))) {
                process.send({ result: block });
                break;
            }
            block.nonce++;
            block.hash = Block.getHash(block);
        }
    }
});
