/**
 * @param {string} type The type of message.
 * @param {any} data The data to include in the message.
 * @returns {string} A JSON object representation of the message.
 */
const prodMsg = (type, data) => JSON.stringify({ type, data }) 

/**
 * @param {string} msg The message to send. >> as returned by prodMsg
 * @param {Array} nodes An array of nodes to send the message to.
 */
const sendMsg = (msg, nodes) => nodes.forEach(node => node.socket.send(msg))

module.exports = { prodMsg, sendMsg };
