const { produceMsg } = require("../message")
const TYPE = require("./message-types")
/**
 * Connects to a WS server at the specified address.
 * */
export const connect = (MY_ADDRESS, address, connected, opened, connectedNodes, fastify) => {
    /**
     * Check if the `address` is not already in the `connected` array and if it is not equal to `MY_ADDRESS`.
     * */
    if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
        const socket = new WS(address)
        /**
         * Open a connection to the socket and send a handshake message to all connected nodes.
         * */
        socket.on("open", async () => {
            for (const _address of [MY_ADDRESS, ...connected]) socket.send(produceMsg(TYPE.HANDSHAKE, _address))
            for (const node of opened) node.socket.send(produceMsg(TYPE.HANDSHAKE, address))

            if (!opened.find(peer => peer.address === address) && address !== MY_ADDRESS) {
                opened.push({ socket, address })
            }
            if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
                connected.push(address)
                connectedNodes++
                fastify.log.info(`Connected to ${address}.`)
                socket.on("close", () => {
                    opened.splice(connected.indexOf(address), 1)
                    fastify.log.info(`Disconnected from ${address}.`)
                })
            }
        })
    }
    return true
}