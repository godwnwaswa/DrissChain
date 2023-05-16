const EC = require("elliptic").ec, ec = new EC("secp256k1")

/**
 * Maintains the node's wallet info.
 * @param _pK - private Key
*/
const wallet = (_pK) => {
  const keyPair = ec.keyFromPrivate(_pK, "hex")
  return {
    pK: keyPair.getPublic("hex"), 
    keyPair
  }
}

module.exports = wallet