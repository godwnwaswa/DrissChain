const connect = require('../server/connect')

const handshake = (
    msg, MAX_PEERS, MY_ADDRESS, connected, opened, 
    connectedNodes, fastify) => {
    const address = msg.data
    if (connectedNodes <= MAX_PEERS) {
        connect(MY_ADDRESS, address, connected, opened, connectedNodes, fastify)
    }

}

module.exports = handshake