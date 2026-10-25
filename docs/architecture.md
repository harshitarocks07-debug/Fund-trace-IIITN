# FundTrace Architecture & System Design

## Overview
FundTrace provides an immutable, transparent ecosystem connecting Non-Governmental Organizations (NGOs), Donors, Government Compliance Authorities, and Auditors.

```
+-------------------------------------------------------------------+
|                        FundTrace Frontend                         |
|  (React 18 + TypeScript + Vite + Interactive Management Dashboard) |
+---------------------------------+---------------------------------+
                                  | REST / JSON
                                  v
+-------------------------------------------------------------------+
|                        FastAPI Backend                            |
|                                                                   |
|  +--------------------+  +--------------------+  +--------------+ |
|  |  NGO Management    |  | Compliance & Audit |  |  Auth / RBAC | |
|  |  Endpoints         |  | Service            |  |  (JWT)       | |
|  +---------+----------+  +---------+----------+  +-------+------+ |
|  |  Project & Budget  |  | Donation Ledger    |  | Expense Mgmt | |
|  |  Endpoints         |  | Service            |  | Endpoints    | |
|  +---------+----------+  +---------+----------+  +-------+------+ |
|            |                       |                     |        |
|            +-----------------------+---------------------+        |
|                                    v                              |
|                         SQLAlchemy ORM Layer                      |
+------------------------------------+------------------------------+
                                     |
               +---------------------+---------------------+
               v                                           v
      +------------------+                       +-------------------+
      | Relational DB    |                       | Blockchain Ledger |
      | (SQLite / Postgre|                       | (FundTraceLedger  |
      | SQL via Engine)  |                       |  Smart Contract)  |
      +------------------+                       +-------------------+
```

## System Subsystems

### 1. NGO Management Lifecycle
1. **Onboarding / Registration**:
   - NGO submits official identity credentials (Registration Number, Darpan ID, PAN).
   - Profiles enter the `PENDING` verification status.
   - Initial transparency score is computed.
2. **Profile Maintenance**:
   - NGOs update mission, vision, operational sectors, geographical footprint, and contact details.
   - Banking accounts and public Ethereum/Polygon wallet addresses are maintained for fund disbursements and cryptographic proof of reserves.
3. **Statutory Compliance & Audit Verification**:
   - Auditors inspect 80G, 12A, and FCRA filings.
   - Status transitions to `VERIFIED`, `REJECTED`, or `SUSPENDED` with audit notes.
   - Real-time transparency score reflects statutory standing.

### 2. Project, Donation, and Expense Modules
- **Project Initiatives**: NGOs define approved budgets, schedule milestone deliverables, and track funding progress vs. budget utilization.
- **Donation Ledger**: Contributions are attributed to specific initiatives or general corpus, minting verifiable on-chain hashes and Section 80G tax receipts.
- **Expense Verification**: Itemized procurement bills are tied to projects and undergo audit review (`PENDING` $\rightarrow$ `APPROVED` / `FLAGGED` / `REJECTED`), with automated ledger debit and rollback.

## Data and Trust Boundaries
Receipt files and beneficiary information remain off-chain in private storage with cryptographic hashes (IPFS / SHA-256) recorded on-chain. Blockchain transaction confirmation and relational database operations maintain explicit state tracking, ensuring resilient auditing and non-repudiation.
