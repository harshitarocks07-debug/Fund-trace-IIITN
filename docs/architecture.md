# FundTrace architecture

## Current prototype

The current runnable prototype is a React + TypeScript single-page application under `frontend/`. It uses sample records persisted in the browser's `localStorage`. The role selector changes the demo persona; it is not authentication or authorization.

Receipt fingerprinting uses the Web Crypto SHA-256 API in the browser. Files are read locally and are not uploaded. Expense risk scores are explainable rule-based signals for demo prioritization, not findings of fraud. Auditor decisions update the local demo record only.

## Intended service architecture

The target system separates:

- **React frontend:** role-specific views and review workflows.
- **FastAPI backend:** identity, permission checks, project/donation/expense APIs, receipt processing, risk rules, and audit events.
- **PostgreSQL:** structured records and transaction references.
- **Private object storage:** original receipts with controlled access and retention.
- **OCR worker:** extracts candidate fields from uploaded evidence; extracted values require human review.
- **EVM contract:** records selected evidence fingerprints and verification events after an auditor decision.

The backend and contract are not connected in this prototype. Do not represent a local demo decision as a blockchain-confirmed event.

## Data and trust boundaries

Receipt files and beneficiary information should remain off-chain. A committed fingerprint can later show whether a presented file matches the committed bytes, but cannot prove the original receipt was genuine. Blockchain transaction submission and confirmation must have separate states; a database record and a chain transaction cannot be committed atomically. If chain submission fails, preserve the audit decision and expose the chain operation as failed or pending retry.

Donation records are not proof of payment unless a payment provider or verified financial feed supplies that evidence. Budget checks must distinguish submitted, approved, and paid expenses and account for concurrent approvals.