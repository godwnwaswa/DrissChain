'use strict'

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
  logger : logger
})

fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'Drisschain RPC',
      description: 'An API interacting with the Drisschain RPC endpoints.',
      version: '0.1.0'
    },
  },
  exposeRoute: true,
  routePrefix: '/'
})

fastify.register(require('./routes/rpc'))

const PORT = 3003

const start = async () => {
  try 
  {
    await fastify.listen(PORT)
  } 
  catch (error) 
  {
    fastify.log.error(error)
  }
}

start()