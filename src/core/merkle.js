/**
 * --------------------------------------------------------------------------------------
 * A Merkle tree is a binary tree where each leaf node is a hash of a data item, and each 
 * non-leaf node is a hash of its two child nodes. This structure is commonly used in 
 * cryptographic applications such as digital signatures and blockchain technology, where 
 * it provides a way to efficiently prove the integrity of a piece of data without 
 * revealing the data itself.
 * --------------------------------------------------------------------------------------
 * 
 * */

const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");

function Node(val, left = null, right = null) {
    return { val, left, right };
}


/**
 * ----------------------------------------------------------------------------------------
 * Takes a node from the Merkle tree and a target hash, and recursively traverses the tree 
 * to find the path of nodes from the root to the target. It returns an array of the values 
 * of the nodes on the path.
 * */
function getMerklePath(node, target, path = []) {
    if (node.val === target) return [...path, target];
    if (node.left === null) return [];

    const path1 = getMerklePath(node.left, target, [...path, node.right.val]);
    const path2 = getMerklePath(node.right, target, [...path, node.left.val]);

    if (path1.length !== 0) return path1;
    if (path2.length !== 0) return path2;

    return [];
}

/**
 * Takes an array of leaf node hashes and a root hash, and checks whether the hashes can be used to 
 * prove the inclusion of a particular leaf node in the tree. It does this by re-calculating the 
 * root hash from the leaf node hashes and comparing it to the given root hash.
 * */
function verifyMerkleProof(leaves, root) {
    let genHash = leaves[0];

    for (let i = 1; i < leaves.length; i++) {
        if (BigInt("0x" + genHash) < BigInt("0x" + leaves[i])) {
            genHash = SHA256(genHash + leaves[i]);
        } else {
            genHash = SHA256(leaves[i] + genHash);
        }
    }

    return genHash === root;
}

/**
 * Takes an array of data items, hashes each item using the SHA-256 hashing algorithm, 
 * and constructs a Merkle tree from the resulting hashes. It returns the root node of the tree.
 * */
function buildMerkleTree(items) {
    if (items.length === 0) return Node(SHA256("0"));

    let hashList = items.map(item => Node(SHA256(item)));
    
    if (hashList.length % 2 !== 0 && hashList.length !== 1) {
        hashList.push(hashList[hashList.length-1]);
    }

    while (hashList.length !== 1) {
        const newRow = [];

        while (hashList.length !== 0) {
            if (hashList.length % 2 !== 0 && hashList.length !== 1) {
                hashList.push(hashList[hashList.length-1]);
            }
    
            const left = hashList.shift();
            const right = hashList.shift();

            if (BigInt("0x" + left.val) < BigInt("0x" + right.val)) {
                const node = Node(SHA256(left.val + right.val), left, right);

                newRow.push(node);
            } else {
                const node = Node(SHA256(right.val + left.val), right, left);

                newRow.push(node);
            }
        }

        hashList = newRow;
    }
    
    return hashList[0];
}

module.exports = { getMerklePath, verifyMerkleProof, buildMerkleTree };
