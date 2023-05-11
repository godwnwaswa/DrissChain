const 
{ 
    getBlockNumber, 
    getAddress, 
    getWork, 
    getMining,
    getBlockByHash, 
    getBlockByNumber, 
    getBlockTxnCountByHash,
    getBlockTxnCountByNumber,
    getBalance
    
} = require("../controllers/rpc")

const Block =  {
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
                    block: Block
                }
            }
        }
    },
    handler: getBlockByHash
}

const getBlockByNumberOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['blockNumber'],
            properties: {
                blockNumber: {type: 'integer'}
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    block: Block
                }
            }
        }
    },
    handler: getBlockByNumber
}


const getBlockTxnCountByHashOpts = {
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
                    count: {type: 'integer'}
                }
            }
        }
    },
    handler: getBlockTxnCountByHash
}

const getBlockTxnCountByNumberOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['blockNumber'],
            properties: {
                blockNumber: {type: 'integer'}
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    count: {type: 'integer'}
                }
            }
        }
    },
    handler: getBlockTxnCountByNumber
}


const getBalanceOpts = {
    schema: {
        body: {
            type: 'object',
            required: ['address'],
            properties: {
                address: {type: 'string'}
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    balance: {type: 'integer'}
                }
            }
        }
    },
    handler: getBalance
}


function rpcRoutes(fastify, options, done)
{
    fastify.get('/block-number', getBlockNumberOpts)
    fastify.get('/address', getAddressOpts)
    fastify.get('/work', getWorkOpts)
    fastify.get('/mining', getMiningOpts)
    fastify.get('/blocks/hash/:_hash', getBlockByHashOpts)
    fastify.get('/blocks/number/:blockNumber', getBlockByNumberOpts)
    fastify.get('/blocks/hash/:_hash/tx_count', getBlockTxnCountByHashOpts)
    fastify.get('/blocks/number/:blockNumber/tx_count', getBlockTxnCountByNumberOpts)
    fastify.post('/address/balance', getBalanceOpts)
    done()
}

module.exports = rpcRoutes