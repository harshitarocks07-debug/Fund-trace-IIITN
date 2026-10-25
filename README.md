# FundTrace — Transparent Giving, Accountable Spending

FundTrace is a decentralized donation-tracking and financial reconciliation platform establishing an immutable, auditable connection between donated funds, authorized spending, and supporting evidence—without exposing beneficiaries' sensitive information.

---

## System Architecture & Implemented Capabilities

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FUNDTRACE ARCHITECTURE                                   │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│ 1. AUTHENTICATION & RBAC               │ 2. PRIVATE RECEIPT STORAGE & OCR              │
│    • PBKDF2-HMAC-SHA256 & JWT Tokens   │    • Whitelist (PDF, PNG, JPG, WEBP) <= 10MB  │
│    • Donor, NGO Admin, Auditor roles   │    • Magic-byte verification & anti-traversal │
│    • Least-privilege endpoint security │    • OCR extraction & auditor cross-checks    │
├────────────────────────────────────────┼───────────────────────────────────────────────┤
│ 3. EVM DECENTRALIZED IMPACT LEDGER     │ 4. MULTI-HOP FLOW TRACKER & RECONCILIATION     │
│    • FundTraceLedger.sol Smart Contract│    • 5-hop timeline: ETH -> USDC -> INR -> Exp│
│    • Zero on-chain PII (keccak256 seal)│    • Autonomous Earmark Mismatch detection    │
│    • Anti-double-claim receipt guard   │    • Slippage, overdraw, & evidence auditing  │
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 1. Multi-Hop Crypto-to-Fiat Flow Tracking

Passively tracks and autonomously reconstructs complex cross-ecosystem financial pipelines:
- **Case Example**: A 50 ETH donation earmarked for *"Clean water infrastructure"* in Bhairavpur:
  1. **Hop 1 (L1 Donation)**: 50.0 ETH transfer from donor wallet to NGO multi-sig treasury.
  2. **Hop 2 (DEX Swap)**: 50.0 ETH swapped for 150,000 USDC via Uniswap v3 (0.12% minimal slippage).
  3. **Hop 3 (Cross-Chain Bridge)**: 150,000 USDC bridged from Ethereum L1 to Polygon PoS via Stargate / LayerZero.
  4. **Hop 4 (Compliant Fiat Off-Ramp)**: 149,950 USDC converted to ₹1,24,50,000 INR into registered NGO bank treasury via zkTLS-attested gateway.
  5. **Hop 5 (Vendor Disbursement)**: ₹2,85,000 INR disbursed to local vendor (*Rajasthan Pipe Works*), linked to approved Expense (`EXP-003`) and anchored by SHA-256 receipt fingerprint (`a81f4d2c...`).

### Autonomous Reconciliation & Anomaly Engine
- **Earmark Mismatch Guard**: Flags attempts to spend funds on incompatible categories (e.g. attempting to claim *"Office supplies"* or *"Luxury travel"* against a *"Clean water infrastructure"* earmark).
- **Overdraw Guard**: Blocks claims exceeding the net realized fiat off-ramp balance.
- **Slippage Guard**: Alerts auditors if DEX swaps experience unexpected price slippage (>6%).
- **Evidence Integrity**: Validates that all disbursements contain verifiable SHA-256 receipt hashes.
- **Zero-PII Privacy Boundary**: Raw vendor bank accounts, beneficiary names, and government IDs remain private off-chain; only cryptographic seals are anchored to the public ledger.

---

## 2. EVM Smart Contract (`FundTraceLedger.sol`)

- **Contract Location**: `FundTrace/blockchain/contracts/FundTraceLedger.sol`
- **Key Functions**:
  - `recordEarmarkedDonation(projectId, donor, amount, earmarkTag, txRef)`
  - `anchorAuditedExpense(projectId, expenseId, claimedAmount, receiptHash, commitmentRoot)`
  - `verifyReceiptCommitment(expenseId, receiptHash)`
- **Security Invariants**:
  - **Zero On-Chain PII**: Anchors only `keccak256(projectId || expenseId || receiptHash || auditor || timestamp)`.
  - **Anti-Double-Claim Shield**: Reverts if a receipt SHA-256 fingerprint has already been claimed for another expense.
  - **Auditor Role Enforcement**: Only verified auditor addresses can anchor approved expense claims.

---

## 3. Running the System

### Backend (FastAPI + SQLite + Web3)
```powershell
cd FundTrace/backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run test suite (41/41 passing tests covering RBAC, Private Storage, OCR, Blockchain, & Multi-Hop Flow Tracker):
```powershell
cd FundTrace/backend
python -m pytest tests/ -v
```

### Frontend (React + TypeScript + Vite)
```powershell
cd FundTrace/frontend
npm install
npm run dev
```
Build verification:
```powershell
npm run build
```

---

## 4. Role-Based Access Control (RBAC) Matrix

| Capability / Action | Donor | NGO Admin | Independent Auditor |
|:---|:---:|:---:|:---:|
| **Register & Sign In** | Yes | Yes | Yes |
| **Browse Projects & Public Summaries** | Yes | Yes | Yes |
| **Contribute Funds** | **Allowed** | Forbidden | Forbidden |
| **Create Projects** | Forbidden | **Allowed** | Forbidden |
| **Upload Receipts & Submit Claims** | Forbidden | **Allowed** | Forbidden |
| **Inspect Raw Receipt Evidence Files** | Forbidden (Private) | **Allowed** | **Allowed** |
| **Review & Approve / Reject Expenses** | Forbidden | Forbidden | **Allowed** |
| **Anchor Expense to EVM Blockchain** | Forbidden | Forbidden | **Allowed** |
| **View Multi-Hop Financial Flows** | **Allowed** | **Allowed** | **Allowed** |
| **Trigger Autonomous Reconciliation** | **Allowed** | **Allowed** | **Allowed** |
| **Simulate Earmark Divergence** | Forbidden | Forbidden | **Allowed** |
| **Inspect Audit Log & Trail** | Forbidden | **Allowed** | **Allowed** |

---

## 5. Demo Personas

| Role | Name | Email | Password |
|:---|:---|:---|:---|
| **Donor** | Aarav Mehta | `donor@aarav.org` | `Password123!` |
| **NGO Admin** | Jal Seva Admin | `admin@jalseva.org` | `Password123!` |
| **Auditor** | Priya Nair | `auditor@trustcheck.org` | `Password123!` |
