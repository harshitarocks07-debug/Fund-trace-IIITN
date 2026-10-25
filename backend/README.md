# FundTrace Backend

High-performance, secure backend API for **FundTrace**, built with FastAPI and SQLAlchemy.

## Features
- **NGO Management**: Maintain NGO profiles, update contact/bank/wallet information, calculate transparency scores, and track compliance metrics (80G, 12A, FCRA, Darpan ID).
- **Project Management**: Create projects, define target budgets, track raised & utilized amounts, and manage project lifecycles (`PLANNING`, `ACTIVE`, `COMPLETED`, `PAUSED`, `CANCELLED`).
- **Donation Management**: Record donations, associate with specific projects or general funds, issue receipts, track payment methods, and compute real-time funding statistics.
- **Expense Management**: Submit expenses, record vendor and invoice details, manage audit statuses (`PENDING`, `APPROVED`, `REJECTED`, `FLAGGED`), attach proof hashes, and track budget utilization.
- **RESTful Endpoints & Validation**: Pydantic v2 schemas, automated input validation, and interactive Swagger UI / ReDoc.

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
