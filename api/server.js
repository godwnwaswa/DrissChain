'use strict'

const fastify = require('fastify')({logger: true})

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

fastify.register(require('./routes/items'))

const PORT = 3000

const start = async () => {
  try {
    await fastify.listen(PORT)

  } catch (error) {
    fastify.log.error(error)
  }
}

start()