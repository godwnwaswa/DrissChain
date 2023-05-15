<div align="center">
	<br/>
	<img src="./assets/realdriss.svg"/>
	<br/>
	<div><b>The RealDriss main integration tree.</b></div>
</div>

## What is Drisseum?

A private blockchain network embedded in the RealDriss core serving as the main integration tree for handling the platform's business logic. It bootstraps a safer, faster and scalable marketplace for buyers and sellers to create, list and exchange value conveniently by use of smart contracts, effectively making RealDriss a decentralized e-commerce platform.

### Interacting with the node through JSON-RPC apis

This process will need you to run an RPC server, leave `true` for `ENABLE_RPC` in `config.json` to enable it.

To properly interact with the node, you should use the JSON-RPC apis, especially if you are creating dapps. To get started, check out [docs for JSON-RPC APIs here.](./JSON-RPC.md)

**Note: This feature is still in its early stages, things might change when a stable release is ready.**

### Run drisseum node publicly

Just do some port-forwarding, drop your public IP + the port you forwarded in and you are set!

If you don't know how to forward port, just search it up online, each router model should have its own way to do port-forwarding.

## Economy 

Note that this is an experimental project which is still under development, and an agreed drisseum network hasn't been formed yet, so this section is mainly just for fun.

### Denominations

| Denom.    | Driss(DRS)    |
|-----------|---------------|
| Driss     | 1             |
| Ols       | 1,000         |
| Omi       | 1,000,000     |
| Bezo      | 1,000,000,000 |

### Tokenomics

* 10,000 DRS is minted originally.
* Current mining reward is 10 DRS.
* Minimum transation fee is 1 DRS.
* Minimum contract execution fee is 0.1 DRS. 



## Copyrights and License

Copyrights © 2023 RealDriss.

This project is licensed under the GPL 3.0 License.
