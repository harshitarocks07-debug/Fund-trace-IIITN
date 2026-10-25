# FundTrace Backend — Authentication & Role-Based Access Control (RBAC)

The FundTrace backend provides identity management, secure user registration, password hashing, HMAC-SHA256 JWT tokens, and fine-grained permission enforcement for three primary roles: **Donor**, **NGO Admin**, and **Auditor**.

---

## 1. Quick Start

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- `pip`

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run the FastAPI Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Interactive API docs are available at `http://127.0.0.1:8000/docs` (Swagger UI).

### Run the Automated Test Suite
```bash
python -m pytest tests/test_auth_and_rbac.py -v
```

---

## 2. Role-Based Access Control (RBAC) Matrix

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

---

## 3. Pre-Seeded Demonstration Accounts

| Role | Name | Email | Password | Scope |
|:---|:---|:---|:---|:---|
| **Donor** | Aarav Mehta | `donor@aarav.org` | `Password123!` | Contribute donations, inspect transparency, view personal contributions |
| **NGO Admin** | Helping Hands Admin | `admin@helpinghands.org` | `Password123!` | Create projects, submit expense claims with SHA-256 fingerprints |
| **Auditor** | Priya Nair | `auditor@trustcheck.org` | `Password123!` | Approve/reject claims, verify receipt hashes, inspect audit trails |

---

## 4. Authentication Endpoints

- `POST /api/v1/auth/register` — Register a new user with full name, email, password, role (`Donor`, `NGO admin`, or `Auditor`), and optional organization. Returns a signed JWT token and user profile.
- `POST /api/v1/auth/login` — Authenticate with email and password. Returns signed JWT token and user profile.
- `GET /api/v1/auth/me` — Protected endpoint returning the profile of the authenticated user.
- `GET /api/v1/auth/permissions` — Returns the explicit permissions list and capability matrix for the logged-in user.
- `GET /api/v1/auth/demo-users` — Lists the pre-configured demonstration accounts for testing.

---

## 5. Security Details

- **Password Hashing**: PBKDF2-HMAC-SHA256 with random salt per user and timing-attack resistant comparison (`hmac.compare_digest`).
- **Token Format**: Standard RFC 7519 JSON Web Tokens (JWT) signed with HMAC-SHA256, expiration tracking, and role claims.
- **Permission Enforcement**: FastAPI dependency injection (`require_donor`, `require_ngo_admin`, `require_auditor`) evaluating token claims and database-backed user records.

