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
    getBalance,
    getCode,
    getCodeHash,
    getStorage,
    getStorageKeys,
    getStorageRoot,
    getTxnByBlockNumberAndIndex,
    getTxnByBlockHashAndIndex,
    signTxn,
    sendTxn,
    
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
        blockNumber: {type : 'number'},
        timestamp: {type : 'number'},
        difficulty: {type : 'number'},
        parentHash: {type : 'string'},
        nonce: {type : 'number'},
        txRoot: {type : 'string'},
        coinbase: {type : 'string'},
        hash: {type : 'string'},
    }
}


const Transaction =  {
    type: 'object',
    properties: {
        recipient: {type : 'string'},
        amount: {type : 'string'},
        gas: {type : 'string'},
        additionalData: {
            type : 'object',
            properties: {}
        },
        nonce: {type : 'number'},
        signature: {
            type : 'object',
            properties: {
                v: {type : 'string'},
                r: {type : 'string'},
                s: {type : 'string'},
            }
        },
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


const postBalanceOpts = {
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


const getCodeOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['codeHash'],
            properties: {
                codeHash: {type: 'string'}
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    code: {type: 'string'}
                }
            }
        }
    },
    handler: getCode
}

const getCodeHashOpts = {
    schema: {
        params: {
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
                    codeHash: {type: 'string'}
                }
            }
        }
    },
    handler: getCodeHash
}
const Storage = {
    type: 'object',
    properties: {
        storage: {type: 'string'}
    }
}

const postStorageOpts = {
    schema: {
        body: {
            type: 'object',
            required: ['address', 'key'],
            properties: {
                address: {type: 'string'},
                key: {type: 'string'}
            }
        },
        response: {
            200: Storage
        }
    },
    handler: getStorage
}

const getStorageKeysOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['address'],
            properties: {
                address: {type: 'string'}
            }
        },
        response: {
            200: Storage
        }
    },
    handler: getStorageKeys
}


const getStorageRootOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['address'],
            properties: {
                address: {type: 'string'},
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    storageRoot: {type: 'string'}
                }
            }
        }
    },
    handler: getStorageRoot
}

const getTxnByBlockHashAndIndexOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['_hash', 'index'],
            properties: {
                _hash: {type: 'string'},
                index: {type: 'integer'},
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    transaction: Transaction
                }
            }
        }
    },
    handler: getTxnByBlockHashAndIndex
}



const getTxnByBlockNumberAndIndexOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['blockNumber', 'index'],
            properties: {
                blockNumber: {type: 'integer'},
                index: {type: 'integer'},
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    transaction: Transaction
                }
            }
        }
    },
    handler: getTxnByBlockNumberAndIndex
}

const sendTxnOpts = {
    schema: {
        body: {
            type: 'object',
            required: ['tx'],
            properties: {
                tx: Transaction
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    message: {type: 'string'}
                }
            }
        }
    },
    handler: sendTxn
}

const signTxnOpts = {
    schema: {
        body: {
            type: 'object',
            required: ['recipient', 'amount'],
            properties: {
                recipient: {type: 'string'},
                amount: {type: 'number'}
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    tx: Transaction
                }
            }
        }
    },
    handler: signTxn
}




function rpcRoutes(fastify, options, done)
{
    fastify.get('/block-number', getBlockNumberOpts)
    fastify.get('/address', getAddressOpts)
    fastify.post('/storage', postStorageOpts)
    fastify.get('/storage/keys/:address', getStorageKeysOpts)
    fastify.get('/storage/root/:address', getStorageRootOpts)
    fastify.post('/address/balance', postBalanceOpts)
    fastify.get('/work', getWorkOpts)
    fastify.get('/mining', getMiningOpts)
    fastify.get('/blocks/hash/:_hash', getBlockByHashOpts)
    fastify.get('/blocks/number/:blockNumber', getBlockByNumberOpts)
    fastify.get('/blocks/hash/:_hash/txn_count', getBlockTxnCountByHashOpts)
    fastify.get('/blocks/number/:blockNumber/txn_count', getBlockTxnCountByNumberOpts)
    fastify.get('/blocks/hash/:_hash/txn/:index', getTxnByBlockHashAndIndexOpts)
    fastify.get('/blocks/number/:blockNumber/txn/:index', getTxnByBlockNumberAndIndexOpts)
    fastify.get('/code/:codeHash', getCodeOpts)
    fastify.get('/code/hash/:address', getCodeHashOpts)
    fastify.post('/txn/sign', signTxnOpts)
    fastify.post('/txn/send', sendTxnOpts)
    done()
}

module.exports = rpcRoutes