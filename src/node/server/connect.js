const WS = require("ws")
const { prodMsg } = require("../message")
const TYPE = require("../message-types")
/**
 * Connects to a WS server at the specified address.
 * @param conn Addresses from connected nodes.
 * @param opened Addresses and sockets from connected nodes.
 * @param connNodes no. of connected nodes
 * */
const connect = (MY_ADDRESS, address, conn, opened, connNodes, fastify) => {
    const res = {conn, opened, connNodes}
    // Check if the `address` is not in the `conn` array and if it is not equal to `MY_ADDRESS`.
    if (!res.conn.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
        const socket = new WS(address)
        // Open a connection to the socket and send a handshake message to all conn nodes.
        socket.on("open", async () => {
            for (const _address of [MY_ADDRESS, ...res.conn]) socket.send(prodMsg(TYPE.HANDSHAKE, _address))
            for (const node of opened) node.socket.send(prodMsg(TYPE.HANDSHAKE, address))

            if (!opened.find(peer => peer.address === address) && address !== MY_ADDRESS) {
                opened.push({ socket, address })
            }
            if (!res.conn.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
                res.conn.push(address)
                res.connNodes++
                fastify.log.info(`Connected to ${address}.`)
                socket.on("close", () => {
                    opened.splice(res.conn.indexOf(address), 1)
                    fastify.log.info(`Disconnected from ${address}.`)
                })
            }
        })
    }
    return res
}

module.exports = connect