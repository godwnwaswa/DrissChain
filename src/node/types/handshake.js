const connect = require('../server/connect')

const handshake = (msg, MAX_PEERS, MY_ADDRESS, conn, opened, connNodes, fastify) => {
    const address = msg.data
    if (connNodes <= MAX_PEERS) {
        return connect(MY_ADDRESS, address, conn, opened, connNodes, fastify)
    }

}

module.exports = handshake