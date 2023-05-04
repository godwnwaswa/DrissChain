/**
 * -----------------------------------------------------------------------------------------------------
 * Enum defining the different types of messages that can be sent between nodes in a blockchain network.
 * -----------------------------------------------------------------------------------------------------
 * 
 * @readonly
 * @enum {number}
 */
const TYPE = {
    /**
     * Indicates a new block being added to the blockchain.
     */
    NEW_BLOCK: 0,

    /**
     * Indicates a new transaction being created and added to the blockchain.
     */
    CREATE_TRANSACTION: 1,

    /**
     * Indicates a request for a block from another node in the network.
     */
    REQUEST_BLOCK: 2,

    /**
     * Indicates a response to a block request, with the requested block data.
     */
    SEND_BLOCK: 3,

    /**
     * Indicates a handshake message between nodes to establish a connection.
     */
    HANDSHAKE: 4
}

module.exports = TYPE;

/**
 * The module exports an enum object that can be used to reference the different message types in a blockchain network.
 * The enum is defined as a constant object with five key-value pairs, each representing a different message type. 
 * The key is a string representing the message type name, while the value is a number assigned to the message type. 
 * This enum is intended to be used as a reference in the implementation of a blockchain network, where messages are sent and received between nodes.
 */