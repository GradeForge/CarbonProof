# CarbonProofRegistry — Deployment Guide

This guide walks through deploying the `CarbonProofRegistry.sol` smart contract
on the **Ethereum Sepolia testnet** (chain ID 11155111) using the Remix browser
IDE and MetaMask.

> **No contract has been deployed yet.** You must deploy it yourself and record
> the actual address in your project's environment variables.

## 1. Open Remix

Go to [https://remix.ethereum.org](https://remix.ethereum.org) in your browser.

## 2. Create and compile the contract

1. In the Remix file explorer, create a new file under `contracts/` called
   `CarbonProofRegistry.sol`.
2. Paste the full contents of `contracts/CarbonProofRegistry.sol` from this
   project.
3. Go to the **Solidity Compiler** tab (the icon that looks like a "S").
4. Set the compiler version to **0.8.20** or higher (match the `pragma` in the
   file — `^0.8.20`).
5. Click **Compile CarbonProofRegistry.sol**. Ensure there are no errors.

## 3. Connect MetaMask to Sepolia

1. Open the MetaMask browser extension.
2. Click the network selector at the top.
3. Select **Sepolia** (if it appears in the test networks list). If not:
   - Click **Add Network** → **Add a network manually**.
   - Network name: `Sepolia`
   - RPC URL: `https://ethereum-sepolia-rpc.publicnode.com`
   - Chain ID: `11155111`
   - Currency symbol: `ETH`
   - Block explorer: `https://sepolia.etherscan.io`
4. Switch MetaMask to the Sepolia network.

## 4. Obtain test ETH from a faucet

You need a small amount of Sepolia ETH to pay for deployment gas.

1. Copy your MetaMask wallet address.
2. Visit one of these faucets:
   - [https://sepoliafaucet.com](https://sepoliafaucet.com) (Alchemy — may require login)
   - [https://www.alchemy.com/faucets/ethereum-sepolia](https://www.alchemy.com/faucets/ethereum-sepolia)
   - [https://faucet.quicknode.com/ethereum/sepolia](https://faucet.quicknode.com/ethereum/sepolia)
3. Paste your address and request test ETH. You typically need 0.05–0.1 ETH.
4. Confirm the ETH arrived in MetaMask (it may take a minute).

## 5. Deploy through Remix using the injected wallet

1. Go to the **Deploy & Run Transactions** tab in Remix (the icon with the
   Ethereum logo and an arrow).
2. Under **Environment**, select **Injected Provider - MetaMask**.
3. MetaMask will prompt you to connect your wallet — approve the connection.
4. Confirm the account shown in Remix matches your MetaMask Sepolia account.
5. Under **Contract**, select `CarbonProofRegistry`.
6. The contract has no constructor arguments, so leave the deploy field empty.
7. Click **Deploy**.
8. MetaMask will open a transaction confirmation popup — review the gas cost
   and click **Confirm**.
9. Wait for the transaction to be mined. Remix will show the deployed contract
   address under **Deployed Contracts** at the bottom.

## 6. Record the deployed contract address

1. Copy the deployed contract address from Remix (it appears next to the
   contract name under "Deployed Contracts").
2. Verify it on Sepolia Etherscan: paste it into the search bar at
   [https://sepolia.etherscan.io](https://sepolia.etherscan.io).
3. Add it to your project's `.env` file:

   ```
   VITE_CARBONPROOF_CONTRACT_ADDRESS=0xYourActualDeployedAddress
   ```

4. Optionally set a custom read-only RPC URL:

   ```
   VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
   ```

   If not set, the app defaults to the same public endpoint.

## 7. Test registration and duplicate rejection in Remix

1. In Remix, expand the deployed contract under **Deployed Contracts**.
2. You need two `bytes32` values:
   - An evidence fingerprint (a 32-byte hex value, e.g. the SHA-256 hash from
     a CarbonProof record).
   - A record ID hash (e.g. `keccak256` of the record's UUID string).
3. For testing, you can use these placeholder values:
   - Fingerprint: `0x` followed by 64 hex characters (any non-zero 32 bytes).
   - Record ID hash: `0x` followed by 64 hex characters (any non-zero 32 bytes).
4. Call `registerEvidence` with those two values. MetaMask will prompt for a
   transaction — confirm it.
5. After the transaction is mined, call `isRegistered` with the same fingerprint
   — it should return `true`.
6. Call `getRegistration` with the same fingerprint — it should return the
   record ID hash, your wallet address, and a timestamp.
7. Try calling `registerEvidence` again with the **same fingerprint** — the
   transaction should **revert** with the error
   `"CarbonProof: fingerprint already registered"`.
8. Try calling `registerEvidence` with a zero fingerprint
   (`0x000...000`) — it should revert with
   `"CarbonProof: zero evidence fingerprint"`.

## 8. Inspect the deployment transaction on Sepolia Etherscan

1. Go to [https://sepolia.etherscan.io](https://sepolia.etherscan.io).
2. Paste your deployed contract address into the search bar.
3. You will see the contract page with:
   - The creation transaction hash.
   - The block number where it was deployed.
   - The creator address.
4. Click the **Contract** tab to verify the source code (you can verify it
   manually by pasting the Solidity source and compiler settings).
5. Click **Events** to see `EvidenceRegistered` events as you register
   fingerprints.

## Security notes

- The contract has no owner or access control — anyone can register evidence.
  This is intentional for the prototype. Duplicate prevention is enforced in
  the contract itself, not just in the frontend.
- The contract does not store documents, private data, or funds.
- On-chain registration proves that a fingerprint was registered by a wallet
  at a time. It does **not** prove that the associated environmental claim is
  truthful, certified, or verified.
- Never store wallet private keys or recovery phrases in the application,
  Supabase, or environment variables.
