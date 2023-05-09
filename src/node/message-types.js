/**
 * 
 * Enum defining the different types of messages that can be sent between nodes in the Drisschain network.
 */
const TYPE = {
    NEW_BLOCK: 0,
    CREATE_TRANSACTION: 1,
    REQUEST_BLOCK: 2,
    SEND_BLOCK: 3,
    HANDSHAKE: 4
}

module.exports = TYPE;