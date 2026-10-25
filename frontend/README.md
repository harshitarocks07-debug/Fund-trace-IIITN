# FundTrace frontend

This is the interactive React + TypeScript demo. It runs independently of the planned backend and keeps its sample records in the current browser.

## Start

```powershell
npm install
npm run dev
```

Use the role selector in the sidebar to switch between NGO admin, auditor, and donor demo views. Select **Reset demo** to restore the original sample data.

Project cards open a funding and spending breakdown. Expense review details include receipt metadata, claimed-versus-entered amounts, risk explanations, and the local audit timeline. Donors see approved expense summaries and their own contribution records only.

`npm run build` runs the TypeScript check and creates a production bundle in `dist/`.

The demo does not authenticate users, upload receipts, process OCR, move donations, or write blockchain transactions.