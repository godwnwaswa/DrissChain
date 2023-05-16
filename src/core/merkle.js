/**
 * 
 * A Merkle tree is a binary tree where each leaf node is a hash of a data item, and each 
 * non-leaf node is a hash of its two child nodes. This structure is commonly used in 
 * cryptographic applications such as digital signatures and blockchain technology, where 
 * it provides a way to efficiently prove the integrity of a piece of data without 
 * revealing the data itself.
 * 
 * */

const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex")

const Node = (val, left = null, right = null) => {
    return { val, left, right }
}


/**
 * Takes a node from the Merkle tree and a target hash, and recursively traverses the tree 
 * to find the path of nodes from the root to the target. It returns an array of the values 
 * of the nodes on the path.
 * */
const getMerklePath = (node, target, path = []) => {
    if (node.val === target) return [...path, target]
    if (node.left === null) return []
    const path1 = getMerklePath(node.left, target, [...path, node.right.val])
    const path2 = getMerklePath(node.right, target, [...path, node.left.val])
    return path1.length !== 0 ? path1 : path2
}

/**
 * Takes an array of leaf node hashes and a root hash, and checks whether the hashes can be used to 
 * prove the inclusion of a particular leaf node in the tree. It does this by re-calculating the 
 * root hash from the leaf node hashes and comparing it to the given root hash.
 * */
const verifyMerkleProof = (leaves, root) => {
    let genHash = leaves[0]
    for (let i = 1; i < leaves.length; i++) {
        genHash = BigInt(`0x${genHash}`) < BigInt(`0x${leaves[i]}`) ? SHA256(`${genHash}${leaves[i]}`) : SHA256(`${leaves[i]}${genHash}`)
    }
    return genHash === root
}

/**
 * Hashes each item in an array using the SHA-256 hashing algorithm, and constructs a Merkle tree 
 * from the resulting hashes. 
 * 
 * @return The root node of the tree.
 * */
const genMTree = items => {
    if (items.length === 0) return Node(SHA256("0"))

    let hashList = items.map(item => Node(SHA256(item)))
    if (hashList.length % 2 !== 0 && hashList.length !== 1) { hashList.push(hashList[hashList.length - 1]) }
    while (hashList.length !== 1) {
        const newRow = []
        while (hashList.length !== 0) {
            if (hashList.length % 2 !== 0 && hashList.length !== 1) {
                hashList.push(hashList[hashList.length - 1])
            }
            const [left, right] = hashList.splice(0, 2)
            const [smaller, larger] = BigInt(`0x${left.val}`) < BigInt(`0x${right.val}`) ? [left, right] : [right, left]
            newRow.push(Node(SHA256(`${smaller.val}${larger.val}`), smaller, larger))
        }
        hashList = newRow
    }
    return hashList[0]
}

module.exports = { getMerklePath, verifyMerkleProof, genMTree }
