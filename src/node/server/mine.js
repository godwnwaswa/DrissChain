const mine = async (publicKey, ENABLE_LOGGING) => {

    const mine = (block, difficulty) => {
        return new Promise((resolve, reject) => {
            worker.addListener("message", message => resolve(message.result))
            worker.send({ type: "MINE", data: [block, difficulty] })
        })
    }

    // Create a new block.
    const block = new Block(chainInfo.latestBlock.blockNumber + 1, Date.now(), [],chainInfo.difficulty, chainInfo.latestBlock.hash, SHA256(publicKey))
    // Collect a list of transactions to mine
    const transactionsToMine = [], states = {}, code = {}, storage = {}, skipped = {}
    let totalContractGas = 0n, totalTxGas = 0n
    const existedAddresses = await stateDB.keys().all()
    for (const tx of chainInfo.txPool) {
        if (totalContractGas + BigInt(tx.additionalData.contractGas || 0) >= BigInt(BLOCK_GAS_LIMIT)) break
        const txSenderPubkey = Transaction.getPubKey(tx)
        const txSenderAddress = SHA256(txSenderPubkey)
        if (skipped[txSenderAddress]) continue // Check if transaction is from an ignored address.
        // Normal coin transfers
        if (!states[txSenderAddress]) {
            const senderState = await stateDB.get(txSenderAddress)
            states[txSenderAddress] = senderState
            code[senderState.codeHash] = await codeDB.get(senderState.codeHash)
            if (senderState.codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true
                continue
            }
            states[txSenderAddress].balance = (BigInt(senderState.balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
        } else {
            if (states[txSenderAddress].codeHash !== EMPTY_HASH) {
                skipped[txSenderAddress] = true
                continue
            }
            states[txSenderAddress].balance = (BigInt(states[txSenderAddress].balance) - BigInt(tx.amount) - BigInt(tx.gas) - BigInt(tx.additionalData.contractGas || 0)).toString()
        }
        if (!existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
            code[EMPTY_HASH] = ""
        }
        if (existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
            states[tx.recipient] = await stateDB.get(tx.recipient)
            code[states[tx.recipient].codeHash] = await codeDB.get(states[tx.recipient].codeHash)
        }
        states[tx.recipient].balance = (BigInt(states[tx.recipient].balance) + BigInt(tx.amount)).toString()
        // Contract deployment
        if (states[txSenderAddress].codeHash === EMPTY_HASH && typeof tx.additionalData.scBody === "string" ) {
            states[txSenderAddress].codeHash = SHA256(tx.additionalData.scBody)
            code[states[txSenderAddress].codeHash] = tx.additionalData.scBody
        }
        // Update nonce
        states[txSenderAddress].nonce += 1
        // Decide to drop or add transaction to block
        if (BigInt(states[txSenderAddress].balance) < 0n) {
            skipped[txSenderAddress] = true
            continue
        } else {
            transactionsToMine.push(tx)
            totalContractGas += BigInt(tx.additionalData.contractGas || 0)
            totalTxGas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0)
        }

        // Contract execution
        if (states[tx.recipient].codeHash !== EMPTY_HASH) {
            const contractInfo = { address: tx.recipient }
            const [newState, newStorage] = await drisscript(code[states[tx.recipient].codeHash], states, BigInt(tx.additionalData.contractGas || 0), stateDB, block, tx, contractInfo, false)
            for (const account of Object.keys(newState)) {
                states[account] = newState[account]
                storage[tx.recipient] = newStorage
            }
        }
    }
    block.transactions = transactionsToMine // Add transactions to block
    block.hash = Block.getHash(block) // Re-hash with new transactions
    block.txRoot = buildMerkleTree(indexTxns(block.transactions)).val // Re-gen transaction root with new transactions
    // Mine the block.
    mine(block, chainInfo.difficulty)
        .then(async result => {
            // If the block is not mined before, we will add it to our chain and broadcast this new block.
            if (!mined) {
                await updateDifficulty(result, chainInfo, blockDB) // Update difficulty
                await blockDB.put(result.blockNumber.toString(), result) // Add block to chain
                await bhashDB.put(result.hash, result.blockNumber.toString()) // Assign block number to the matching block hash
                chainInfo.latestBlock = result // Update chain info
                // Reward
                if (!existedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = { balance: "0", codeHash: EMPTY_HASH, nonce: 0, storageRoot: EMPTY_HASH }
                    code[EMPTY_HASH] = ""
                }
                if (existedAddresses.includes(result.coinbase) && !states[result.coinbase]) {
                    states[result.coinbase] = await stateDB.get(result.coinbase)
                    code[states[result.coinbase].codeHash] = await codeDB.get(states[result.coinbase].codeHash)
                }
                let gas = 0n
                for (const tx of result.transactions) { gas += BigInt(tx.gas) + BigInt(tx.additionalData.contractGas || 0) }
                states[result.coinbase].balance = (BigInt(states[result.coinbase].balance) + BigInt(BLOCK_REWARD) + gas).toString()
                // Transit state
                for (const address in storage) {
                    const storageDB = new Level(__dirname + "/../log/accountStore/" + address)
                    const keys = Object.keys(storage[address])
                    states[address].storageRoot = buildMerkleTree(keys.map(key => key + " " + storage[address][key])).val
                    for (const key of keys) {
                        await storageDB.put(key, storage[address][key])
                    }
                    await storageDB.close()
                }

                for (const account of Object.keys(states)) {
                    await stateDB.put(account, states[account])
                    await codeDB.put(states[account].codeHash, code[states[account].codeHash])
                }
                // Update the new transaction pool (remove all the transactions that are no longer valid).
                chainInfo.txPool = await clearDepreciatedTxns(chainInfo, stateDB)
                sendMsg(produceMsg(TYPE.NEW_BLOCK, chainInfo.latestBlock), opened) // Broadcast the new block
                fastify.log.info(`NEW_BLOCK* mined. Synced at height #${chainInfo.latestBlock.blockNumber}, chain state transited.`)
            } else {
                mined = false
            }
            // Re-create the worker thread
            worker.kill()
            worker = fork(`${__dirname}/../miner/worker.js`)
        })
        .catch(err => fastify.log.error(err))
}