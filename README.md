# FundTrace — transparent giving, accountable spending

FundTrace is a prototype for tracking NGO projects, recorded donations, expense submissions, receipt fingerprints, and auditor review decisions.

## Run the interactive frontend demo

Requirements: Node.js 18 or later and npm.

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Use the **Demo role** selector to switch between the NGO admin, auditor, and donor views.

## What the demo can do

- Review project budgets, recorded contributions, and submitted expenses.
- Open detailed project breakdowns with funding progress, budget and approved-spend totals, status counts, expenses, and contribution activity.
- Inspect expense evidence metadata, claim-versus-receipt amount checks, risk explanations, and review timelines.
- Create projects and submit expenses.
- Calculate a SHA-256 receipt fingerprint locally in the browser and flag exact file matches.
- Enter an OCR-like receipt amount manually to exercise the amount-mismatch risk rule.
- Show explainable risk indicators and let the auditor demo role approve, reject, or request more evidence.
- Keep demo data in browser `localStorage`; **Reset demo** restores the sample workspace.

## Prototype limitations

This repository currently contains a frontend-only demo. Authentication and role access are simulated; browser-local data is not shared or tamper-proof. Donation entries do not move or verify real money. Receipt OCR, secure file storage, backend persistence, and blockchain transactions are not connected. SHA-256 identifies exact file-byte matches only and does not establish receipt authenticity or fraud.

See [docs/architecture.md](docs/architecture.md) for the intended production architecture and integration boundaries.