const { getBlockNumber, getAddress, getWork, updateItem, getMining } = require("../controllers/rpc")

const Item = {
    type: 'object',
    properties: {
        id: {type: 'string'},
        name: {type: 'string'},
    }
}

const getBlockNumberOpts = {
    schema: {
        response: {
            200 : {
                type : 'object',
                properties: {
                    blockNumber: {type: 'integer'}
                }
            }
        }
    },
    handler: getBlockNumber

}

const getAddressOpts = {
    schema: {
        response: {
            200: {
                type : 'object',
                properties: {
                    address: {type: 'string'}
                }
            }
        }
    },
    handler: getAddress
}

const getWorkOpts = {
    schema: {
        response: {
            200: {
                type : 'object',
                properties: {
                    hash: {type: 'string'},
                    nonce: {type: 'integer'},
                }
            }
        }
    },
    handler: getWork
}

const getMiningOpts = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    mining: {type : 'boolean'}
                }
            }
        }
    },
    handler: getMining
}

const updateItemOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['id'],
            properties: {
                id: {type: 'string'}
            }
        },
        body: {
            type: "object",
            required: ["name"],
            properties: {
                name: { type: 'string'}
            }
        },
        response: {
            200: Item
        }
    },
    handler: updateItem
}

function rpcRoutes(fastify, options, done)
{
    fastify.get('/block-number', getBlockNumberOpts)
    fastify.get('/address', getAddressOpts)
    fastify.get('/work', getWorkOpts)
    fastify.get('/mining', getMiningOpts)
    // fastify.delete('/items/:id', deleteItemOpts)
    // fastify.put('/items/:id', updateItemOpts)
    done()
}

module.exports = rpcRoutes