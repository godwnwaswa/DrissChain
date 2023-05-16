const { server } = require("./src/node/server");
const config = require("./config.json");
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

const node = async () => {
    await server(config, fastify);
}

node()
