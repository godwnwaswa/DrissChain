'use strict'
const pino = require('pino');
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'pid,hostname',
    },
  },
});
const fastify = require('fastify')({
  logger : logger
});

fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'Fastify api',
      description: 'Fastify swagger',
      version: '0.1.0'
    },
  },
  exposeRoute: true,
  routePrefix: '/docs'
})

fastify.register(require('./routes/rpc'))

const PORT = 3003

const start = async () => {
  try {
    await fastify.listen(PORT)

  } catch (error) {
    fastify.log.error(error)
  }
}

start()