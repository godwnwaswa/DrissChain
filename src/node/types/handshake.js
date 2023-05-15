const pino = require('pino')
const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            ignore: 'pid,hostname',
        },
    },
})
const fastify = require('fastify')({
    logger: logger
})

const {connect} = require('../server/connect')

export const handshake = (msg, MAX_PEERS, MY_ADDRESS, address, connected, opened, connectedNodes) => {
    const address = msg.data
    if (connectedNodes <= MAX_PEERS) {
        connect(MY_ADDRESS, address, connected, opened, connectedNodes)
    }

}