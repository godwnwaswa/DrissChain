/**
 * @param {string} type The type of message.
 * @param {any} data The data to include in the message.
 * @returns {string} A JSON object representation of the message.
 */
function prodMsg(type, data) 
{
    return JSON.stringify({ type, data });
}

/**
 * @param {string} message The message to send.
 * @param {Array} nodes An array of nodes to send the message to.
 */
function sendMsg(msg, nodes) 
{
    nodes.forEach(node => node.socket.send(msg));
}

module.exports = { prodMsg, sendMsg };
