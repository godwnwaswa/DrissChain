/**
 * Returns a JSON stringified object with the given type and data.
 *
 * @param {string} type - The type of message.
 * @param {any} data - The data to include in the message.
 * @returns {string} - A JSON stringified object with the given type and data.
 */
function produceMessage(type, data) {
    return JSON.stringify({ type, data });
}

/**
 * Sends the given message to each node in the given array of nodes.
 *
 * @param {string} message - The message to send.
 * @param {Array} nodes - An array of nodes to send the message to.
 */
function sendMessage(message, nodes) {
    nodes.forEach(node => node.socket.send(message));
}

module.exports = { produceMessage, sendMessage };
