export const handshake = (msg) => {
    const address = msg.data
    if (connectedNodes <= MAX_PEERS) {
        connect(MY_ADDRESS, address)
    }

}