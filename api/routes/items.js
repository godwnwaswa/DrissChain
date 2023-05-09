const { getItems, getItem, addItem } = require("../controllers/items")

const Item = {
    type: 'object',
    properties: {
        id: {type: 'string'},
        name: {type: 'string'},
    }
}

const getItemsOpts = {
    schema: {
        response: {
            200 : {
                type : 'array',
                items: Item
            }
        }
    },
    handler: getItems

}

const getItemOpts = {
    schema: {
        response: {
            200: Item
        }
    },
    handler: getItem
}

const postItemsOpts = {
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

function itemsRoutes(fastify, options, done)
{
    fastify.get('/items', getItemsOpts)
    fastify.get('/items/:id', getItemOpts)
    fastify.post('/items', postItemsOpts)
    done()
}

module.exports = itemsRoutes