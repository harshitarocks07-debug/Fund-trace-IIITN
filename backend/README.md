# FundTrace Backend — Architecture, Features & RBAC

High-performance, secure backend API for **FundTrace**, built with FastAPI and SQLAlchemy.

## Features
- **NGO Management**: Maintain NGO profiles, update contact/bank/wallet information, calculate transparency scores, and track compliance metrics (80G, 12A, FCRA, Darpan ID).
- **Project Management**: Create projects, define target budgets, track raised & utilized amounts, and manage project lifecycles (`PLANNING`, `ACTIVE`, `COMPLETED`, `PAUSED`, `CANCELLED`).
- **Donation Management**: Record donations, associate with specific projects or general funds, issue receipts, track payment methods, and compute real-time funding statistics.
- **Expense Management**: Submit expenses, record vendor and invoice details, manage audit statuses (`PENDING`, `APPROVED`, `REJECTED`, `FLAGGED`), attach proof hashes, and track budget utilization.
- **Multi-Hop Fund Flow Tracking**: End-to-end tracking of grant flows across parent NGOs, regional chapters, and vendors.
- **OCR Receipt Verification**: Automated text extraction and SHA-256 fingerprinting for expense audit defense.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for **Donor**, **NGO Admin**, and **Auditor**.

## Setup and Running

1. Activate virtual environment:
   ```bash
   # Windows PowerShell
   .venv\Scripts\Activate.ps1
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run development server (either entrypoint):
   ```bash
   uvicorn main:app --reload --port 8000
   # or
   uvicorn app.main:app --reload --port 8000
   ```

4. Interactive API Docs:
   - Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## Testing
Run automated pytest suite:
```bash
pytest tests/ -v
```

## Role-Based Access Control (RBAC) Matrix

| Capability / Action | Donor | NGO Admin | Independent Auditor |
|:---|:---:|:---:|:---:|
| **User Registration & Login** | Yes | Yes | Yes |
| **Inspect Projects & Budgets** | Yes | Yes | Yes |
| **Create New Projects** | Forbidden (403) | **Allowed (201)** | Forbidden (403) |
| **Submit Expense Claims & Receipt Hashes** | Forbidden (403) | **Allowed (201)** | Forbidden (403) |
| **Make Donations to Projects** | **Allowed (201)** | Forbidden (403) | Forbidden (403) |
| **Approve / Reject Expense Claims** | Forbidden (403) | Forbidden (403) | **Allowed (200)** |
| **Verify SHA-256 Receipt Fingerprints** | Forbidden (403) | Allowed (200) | Allowed (200) |
| **Access Audit Log / Decision Trail** | Forbidden (403) | Allowed (200) | Allowed (200) |

## Pre-Seeded Demonstration Accounts

| Role | Name | Email | Password | Scope |
|:---|:---|:---|:---|:---|
| **Donor** | Aarav Mehta | `donor@aarav.org` | `Password123!` | Contribute donations, inspect transparency |
| **NGO Admin** | Vidya Jyoti Admin | `admin@helpinghands.org` | `Password123!` | Create projects, submit expenses |
| **Auditor** | Priya Nair | `auditor@trustcheck.org` | `Password123!` | Review claims, audit receipt hashes |
