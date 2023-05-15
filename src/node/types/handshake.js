export const handshake = (_message) => {
    const address = _message.data
    if (connectedNodes <= MAX_PEERS) {
        connect(MY_ADDRESS, address)
    }

}