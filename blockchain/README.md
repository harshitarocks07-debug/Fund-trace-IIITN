# FundTrace Blockchain Layer

Decentralized impact verification ledger that anchors auditor-approved expense claims and cryptographic receipt fingerprints to EVM blockchains without leaking beneficiaries' sensitive personal or financial information.

## Architecture

- **`contracts/FundTraceLedger.sol`**: Core smart contract deployed on EVM-compatible chains (Ethereum, Polygon, Arbitrum, Base, local Hardhat).
- **Zero-PII On-Chain Storage**: Raw receipt documents, vendor bank accounts, and beneficiary names stay 100% off-chain. Only the cryptographic fingerprint ($\text{SHA-256}(\text{ReceiptBytes})$) and auditor decision hashes are committed.
- **Anti-Double-Claiming**: The contract enforces a global unique mapping for receipt fingerprints (`receiptToExpense`), rejecting attempts to submit the same invoice against multiple projects or grants.
- **Independent Verification**: Anyone possessing a receipt file can compute its hash locally and invoke `verifyReceiptCommitment(expenseId, receiptHash)` to verify that an authorized auditor signed off on it.

## Testing & Deployment

```bash
# Compile contracts
npm run compile

# Run automated tests
npm test

# Deploy to local network
npm run deploy:local
```

