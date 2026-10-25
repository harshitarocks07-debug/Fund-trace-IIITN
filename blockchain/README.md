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

# FundTrace multi-chain escrow

`FundTraceEscrow` is an EVM-native escrow prototype for Ethereum Sepolia and
Polygon Amoy. Deploy one instance per network with the same five independently
controlled validator addresses. Registration, disbursement, cross-chain
duplicate attestations, evidence resolution, and project freeze changes require
3 of those 5 validators. There is no owner or auditor override in this contract.

The contract automatically freezes both affected projects when a second claim
uses an exact receipt hash already claimed on that chain. A duplicate observed
on another chain can be relayed to this instance with a 3-of-5 typed-data
attestation. EIP-712 signatures are domain-separated by chain and contract.
Only the first claim is recorded; duplicate evidence cannot be disbursed until
the validator quorum explicitly resolves it.

## Deploying

Set `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` for Sepolia, or
`POLYGON_AMOY_RPC_URL` and `POLYGON_AMOY_PRIVATE_KEY` for Polygon Amoy. For
either testnet, also set `FUNDTRACE_VALIDATOR_ADDRESSES` to five distinct
validator addresses separated by commas. Keep each validator key independently
controlled and do not use a single operator for all five.

Run `npm run deploy:escrow:sepolia` or
`npm run deploy:escrow:polygonAmoy`. Local Hardhat deployments use the first
five local accounts as validators; run `npm run deploy:escrow:local` with a
local node running.

## Trust and scope limits

SHA-256 detects byte-identical evidence, not a forged document with altered
bytes. OCR, matching invoice metadata, issuer verification, and human/community
evidence may identify suspicious documents, but only independent validators
can attest those findings here. The contract does not prove an invoice is
genuine, bridge assets between networks, or control a fiat provider's custody
or bank payout. The off-ramp must keep fiat payouts cancellable until the
corresponding quorum authorization is verified.

## Provider-neutral fiat webhook

Configure `FIAT_WEBHOOK_PROVIDER` and `FIAT_WEBHOOK_SECRET` in the backend
environment. The provider sends `POST /api/v1/fiat-settlements/webhooks/{provider}`
with `X-FundTrace-Signature: sha256=<HMAC-SHA256 of the exact request body>`.
The payload uses `eventId`, `settlementReference`, optional `expenseId`,
`projectId`, and `chainId`, plus `evidenceHash`, `amount`, `currency`, and a
`status` of `pending`, `settled`, or `failed`. Exact event replays are
idempotent. Reused evidence hashes or settlement references are marked
`QUORUM_REQUIRED`; this is an alert, not proof that an escrow has frozen.
Only the SHA-256 of the raw event is retained, not the webhook body.
