# FundTrace demo workflow

1. Open the frontend and choose a persona with the **Demo role** control.
2. As NGO admin, create or browse a project and submit an expense. Optionally attach a PDF/image and enter a receipt amount for the manual comparison rule.
3. Review the generated risk score and reasons. Exact receipt-file matches are found by comparing SHA-256 fingerprints; amount mismatches and missing receipts also raise review signals.
4. Switch to Auditor, open the review queue, and inspect the expense evidence metadata and warnings.
5. Approve, reject, or request more evidence, optionally adding an audit note.
6. Inspect the local audit log and switch to Donor to view project funding summaries.
7. Use **Reset demo** to restore the sample dataset.

## Demo caveats

All records are browser-local sample data. Role selection does not secure access. No real payments, OCR, backend API, uploaded file storage, or blockchain transactions are involved. Explain that risk flags support investigation and do not establish fraud.