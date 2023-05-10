const { getBlockNumber, getAddress, getWork, getBlockByHash, getMining } = require("../controllers/rpc")

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

const getBlockByHashOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['_hash'],
            properties: {
                _hash: {type: 'string'}
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    block: {
                        type: 'object',
                        properties: {
                            transactions: {
                                type : 'array',
                                items: {
                                    type: 'string'
                                }
                            },
                            blockNumber: {type : 'integer'},
                            timestamp: {type : 'integer'},
                            difficulty: {type : 'number'},
                            parentHash: {type : 'string'},
                            nonce: {type : 'integer'},
                            txRoot: {type : 'string'},
                            coinbase: {type : 'string'},
                            hash: {type : 'string'},
                        }
                    }
                }
            }
        }
    },
    handler: getBlockByHash
}

function rpcRoutes(fastify, options, done)
{
    fastify.get('/block-number', getBlockNumberOpts)
    fastify.get('/address', getAddressOpts)
    fastify.get('/work', getWorkOpts)
    fastify.get('/mining', getMiningOpts)
    fastify.get('/blocks/hash/:_hash', getBlockByHashOpts)
    // fastify.put('/items/:id', updateItemOpts)
    done()
}

module.exports = rpcRoutes