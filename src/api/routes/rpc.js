const { getBlockNumber, getItem, addItem, updateItem, deleteItem } = require("../controllers/rpc")

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
                    blockNumber: {type: 'string'}
                }
            }
        }
    },
    handler: getBlockNumber

}

const getItemOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['id'],
            properties: {
                id: {type: 'string'}
            }
        },
        response: {
            200: Item
        }
    },
    handler: getItem
}

const postItemOpts = {
    schema: {
        body: {
            type: "object",
            required: ["id", "name"],
            properties: {
                id: { type: 'string'},
                name: { type: 'string'}
            }
        },
        response: {
            201: Item
        }
    },
    handler: addItem
}

const deleteItemOpts = {
    schema: {
        params: {
            type: 'object',
            required: ['id'],
            properties: {
                id: {type: 'string'}
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    message: {type : 'string'}
                }
            }
        }
    },
    handler: deleteItem
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

function itemsRoutes(fastify, options, done)
{
    fastify.get('/block-number', getBlockNumberOpts)
    // fastify.get('/items/:id', getItemOpts)
    // fastify.post('/items', postItemOpts)
    // fastify.delete('/items/:id', deleteItemOpts)
    // fastify.put('/items/:id', updateItemOpts)
    done()
}

module.exports = itemsRoutes