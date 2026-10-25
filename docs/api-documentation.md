# FundTrace REST API Documentation

Base URL: `http://127.0.0.1:8000/api/v1`

---

## NGO Management Endpoints

### 1. List NGOs
* **Endpoint**: `GET /ngos/`
* **Query Parameters**:
  * `search` (string, optional): Search across NGO name, registration number, Darpan ID, city, and mission.
  * `category` (string, optional): Sector filter (`Education`, `Healthcare`, `Environment`, etc.).
  * `status` (string, optional): Verification status filter (`VERIFIED`, `PENDING`, `REJECTED`, `SUSPENDED`).
  * `city` (string, optional): Headquarters city filter.
  * `skip` (integer, default `0`): Pagination offset.
  * `limit` (integer, default `50`): Maximum records to return.
* **Response**: `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "name": "Vidya Jyoti Foundation",
      "legal_name": "Vidya Jyoti Educational Trust India",
      "registration_number": "MH-NGP-2018-00452",
      "darpan_id": "MH/2018/0198421",
      "category": "Education",
      "mission": "Empowering underprivileged children with tech-enabled modern education...",
      "contact_email": "contact@vidyajyoti.org",
      "contact_phone": "+91-98234-56789",
      "city": "Nagpur",
      "state": "Maharashtra",
      "verification_status": "VERIFIED",
      "transparency_score": 95.0,
      "total_funds_received": 4500000.0,
      "total_funds_utilized": 3820000.0,
      "active_projects_count": 6,
      "beneficiaries_count": 12400
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 50
}
```

---

### 2. Register NGO Profile
* **Endpoint**: `POST /ngos/`
* **Request Body**: `NGOCreate`
```json
{
  "name": "Pratham Shiksha Trust",
  "legal_name": "Pratham Shiksha National Trust",
  "registration_number": "MH-2024-TEST-001",
  "darpan_id": "MH/2024/0998877",
  "category": "Education",
  "mission": "Empowering every child with foundational literacy.",
  "contact_email": "contact@prathamtest.org",
  "contact_phone": "+91-9988776655",
  "city": "Nagpur",
  "state": "Maharashtra",
  "has_80g_certificate": true,
  "has_12a_certificate": true,
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678"
}
```
* **Response**: `201 Created`

---

### 3. Get NGO Profile by ID
* **Endpoint**: `GET /ngos/{ngo_id}`
* **Response**: `200 OK`
* Returns full public and operational profile for the NGO.

---

### 4. Update NGO Profile
* **Endpoint**: `PUT /ngos/{ngo_id}` (or `PUT /ngos/me`)
* **Request Body**: `NGOUpdate` (partial fields allowed)
* **Response**: `200 OK`
* Updates specified fields and recalculates transparency score dynamically.

---

### 5. Auditor Verification Status Update
* **Endpoint**: `PATCH /ngos/{ngo_id}/status`
* **Request Body**:
```json
{
  "verification_status": "VERIFIED",
  "verification_notes": "All statutory certificates and registration records verified against NITI Aayog portal."
}
```
* **Response**: `200 OK`
* Validates status against `["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]`, updates `verified_at`, and adjusts `transparency_score`.

---

### 6. NGO Statistics & Compliance
* **Endpoint**: `GET /ngos/{ngo_id}/stats`
* **Response**: `200 OK`
```json
{
  "ngo_id": 1,
  "name": "Vidya Jyoti Foundation",
  "total_funds_received": 4500000.0,
  "total_funds_utilized": 3820000.0,
  "utilization_rate": 84.89,
  "active_projects_count": 6,
  "beneficiaries_count": 12400,
  "transparency_score": 95.0,
  "verification_status": "VERIFIED",
  "compliance": {
    "has_80g": true,
    "has_12a": true,
    "has_fcra": true,
    "fcra_number": "083780512",
    "darpan_id": "MH/2018/0198421",
    "wallet_registered": true
  }
}
```

---

## Project Management Endpoints

Base URL: `http://127.0.0.1:8000/api/v1/projects`

### 1. List Projects with Filtering & Pagination
* **Endpoint**: `GET /projects/`
* **Query Parameters**:
  * `search` (string, optional): Search keyword against project title, description, or location.
  * `status` (string, optional): Lifecycle filter (`PLANNING`, `ACTIVE`, `COMPLETED`, `PAUSED`, `CANCELLED`).
  * `category` (string, optional): Sector filter (`Education`, `Healthcare`, `Environment`, `Clean Water`, `Livelihood`, etc.).
  * `ngo_id` (integer, optional): Scope results to a specific managing NGO profile.
  * `skip` (integer, default `0`): Pagination offset.
  * `limit` (integer, default `50`): Maximum records to return.
* **Response**: `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "ngo_id": 1,
      "ngo_name": "Vidya Jyoti Foundation",
      "title": "Digital Classrooms for Rural Vidarbha",
      "description": "Equipping 25 rural schools in Nagpur and Wardha districts with smart tablets...",
      "category": "Education",
      "target_budget": 1250000.0,
      "raised_amount": 950000.0,
      "utilized_amount": 620000.0,
      "currency": "INR",
      "status": "ACTIVE",
      "start_date": "2024-01-15",
      "end_date": "2024-12-31",
      "location": "Nagpur & Wardha, Maharashtra",
      "beneficiaries_target": 3500,
      "beneficiaries_reached": 2100,
      "wallet_address": "0x71C...B29",
      "funding_progress_pct": 76.0,
      "budget_utilization_pct": 65.26,
      "milestones": [
        {"title": "Hardware Procurement", "target_date": "2024-03-31", "status": "COMPLETED"}
      ]
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 50
}
```

---

### 2. Create Project & Define Budget
* **Endpoint**: `POST /projects/`
* **Request Body**: `ProjectCreate`
```json
{
  "ngo_id": 1,
  "title": "Solar Powered Clean Water Wells",
  "description": "Installing 10 solar water filtration units in drought-prone villages.",
  "category": "Clean Water",
  "target_budget": 850000.0,
  "currency": "INR",
  "status": "PLANNING",
  "start_date": "2024-04-01",
  "end_date": "2024-11-30",
  "location": "Yavatmal, Maharashtra",
  "beneficiaries_target": 5000,
  "milestones": [
    {"title": "Hydrogeological Survey", "target_date": "2024-04-30", "status": "IN_PROGRESS"},
    {"title": "Pump Installation", "target_date": "2024-08-31", "status": "PENDING"}
  ]
}
```
* **Validation**:
  * `target_budget` must be strictly positive (`> 0`).
  * `ngo_id` must reference an active, existing NGO profile.
  * `status` must match one of the allowed lifecycle states.
* **Response**: `201 Created`

---

### 3. Get Project Details by ID
* **Endpoint**: `GET /projects/{project_id}`
* **Response**: `200 OK`
* Returns complete project record including managing NGO details, budget metrics, and milestones roadmap.

---

### 4. Update Project Details & Budget
* **Endpoint**: `PUT /projects/{project_id}`
* **Request Body**: `ProjectUpdate` (partial fields allowed)
```json
{
  "target_budget": 950000.0,
  "utilized_amount": 250000.0,
  "beneficiaries_reached": 1200
}
```
* **Response**: `200 OK`
* Updates project metrics, keeps track of modifications, and recalculates budget metrics.

---

### 5. Track Project Status Lifecycle
* **Endpoint**: `PATCH /projects/{project_id}/status`
* **Request Body**: `ProjectStatusUpdate`
```json
{
  "status": "COMPLETED",
  "notes": "All milestones achieved, solar units inspected and handed over to gram panchayat."
}
```
* **Supported Lifecycle States**: `PLANNING` $\rightarrow$ `ACTIVE` $\rightarrow$ `COMPLETED` (or `PAUSED` / `CANCELLED`).
* **Side Effects**: Automatically increments or decrements the managing NGO's `active_projects_count`.
* **Response**: `200 OK`

---

### 6. Budget & Expenditure Analytics
* **Endpoint**: `GET /projects/{project_id}/budget`
* **Response**: `200 OK`
```json
{
  "project_id": 1,
  "title": "Digital Classrooms for Rural Vidarbha",
  "target_budget": 1250000.0,
  "raised_amount": 950000.0,
  "utilized_amount": 620000.0,
  "remaining_budget": 330000.0,
  "budget_gap": 300000.0,
  "funding_progress_pct": 76.0,
  "budget_utilization_pct": 65.26,
  "status": "ACTIVE",
  "currency": "INR",
  "milestones": [
    {"title": "Hardware Procurement", "target_date": "2024-03-31", "status": "COMPLETED"}
  ]
}
```

---

### 7. Delete Project (Soft Delete)
* **Endpoint**: `DELETE /projects/{project_id}`
* **Response**: `200 OK`
* Sets `is_active = False` to preserve financial audit trail, and decrements the parent NGO's `active_projects_count` if the project was `ACTIVE`.

---

## Donation Management Endpoints

Base URL: `http://127.0.0.1:8000/api/v1/donations`

### 1. Record Donation & Project Allocation
* **Endpoint**: `POST /donations/`
* **Request Body**: `DonationCreate`
```json
{
  "donor_name": "TechForGood CSR Trust",
  "donor_email": "grants@techforgood.org",
  "donor_pan": "AAACT8921B",
  "amount": 150000.0,
  "currency": "INR",
  "ngo_id": 1,
  "project_id": 1,
  "payment_method": "BANK_TRANSFER",
  "is_anonymous": false,
  "notes": "CSR Grant for Phase 2 smart classroom equipment."
}
```
* **Validation & Features**:
  * Validates recipient NGO exists.
  * When `project_id` is supplied, validates that the project belongs to the recipient NGO.
  * Automatically creates an on-chain simulated `tx_hash` (or accepts a gateway hash).
  * Generates a Section 80G tax receipt number (`REC-YYYYMMDD-XXXX`).
  * Automatically increments `project.raised_amount` and `ngo.total_funds_received`.
* **Response**: `201 Created`

---

### 2. List Donations & Filter Ledger
* **Endpoint**: `GET /donations/`
* **Query Parameters**:
  * `ngo_id` (integer, optional): Filter by NGO.
  * `project_id` (integer, optional): Filter by associated project initiative.
  * `status` (string, optional): `CONFIRMED`, `PENDING`, `FAILED`.
  * `payment_method` (string, optional): `UPI`, `BANK_TRANSFER`, `CARD`, `CRYPTO`, `CHEQUE`.
  * `search` (string, optional): Search keyword against donor name, tx hash, receipt number, or notes.
  * `skip` (integer, default `0`): Pagination offset.
  * `limit` (integer, default `50`): Maximum records to return.
* **Response**: `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "donor_name": "TechForGood CSR Trust",
      "donor_email": "grants@techforgood.org",
      "donor_pan": "AAACT8921B",
      "amount": 150000.0,
      "currency": "INR",
      "ngo_id": 1,
      "ngo_name": "Vidya Jyoti Foundation",
      "project_id": 1,
      "project_title": "Digital Classrooms for Rural Vidarbha",
      "payment_method": "BANK_TRANSFER",
      "is_anonymous": false,
      "status": "CONFIRMED",
      "tx_hash": "0x3a12...9f4b",
      "receipt_number": "REC-20240212-001",
      "tax_benefit_claimed": true,
      "created_at": "2026-02-12T10:30:00Z"
    }
  ],
  "total": 1,
  "total_amount": 150000.0,
  "skip": 0,
  "limit": 50
}
```

---

### 3. Donation Statistics & Project Allocation Breakdown
* **Endpoint**: `GET /donations/stats/summary`
* **Query Parameters**:
  * `ngo_id` (integer, optional): Scope metrics to a specific NGO.
  * `project_id` (integer, optional): Scope metrics to a specific project.
* **Response**: `200 OK`
```json
{
  "total_donations": 5,
  "total_amount": 1800000.0,
  "average_amount": 360000.0,
  "currency": "INR",
  "projects_funded_count": 3,
  "by_project": [
    {
      "project_id": 1,
      "project_title": "Digital Classrooms for Rural Vidarbha",
      "target_budget": 1250000.0,
      "total_raised": 950000.0,
      "donation_count": 2,
      "raised_from_donations": 550000.0
    }
  ],
  "monthly_trend": [
    {"month": "Jan", "amount": 750000.0},
    {"month": "Feb", "amount": 1050000.0}
  ],
  "recent_donors": [...]
}
```

---

### 4. Get Donation Details & 80G Tax Receipt
* **Endpoint**: `GET /donations/{donation_id}`
* **Endpoint**: `GET /donations/{donation_id}/receipt`
* **Response**: `200 OK`
* Generates statutory Section 80G compliant receipt with donor PAN, NGO registration number, NITI Aayog Darpan ID, verified transaction hash, and timestamp.

---

### 5. Delete Donation (Soft Delete & Rollback)
* **Endpoint**: `DELETE /donations/{donation_id}`
* **Response**: `200 OK`
* Sets `is_active = False` and automatically adjusts the corresponding `project.raised_amount` and `ngo.total_funds_received`.

---

## Expense Management Endpoints

Base URL: `http://127.0.0.1:8000/api/v1/expenses`

### 1. Submit Expense Voucher
* **Endpoint**: `POST /expenses/`
* **Request Body**: `ExpenseCreate`
```json
{
  "title": "Classroom Tablets & Solar Chargers",
  "description": "Procurement of 25 rugged tablets and 5 solar charging hubs for remote schools.",
  "category": "Hardware",
  "amount": 185000.0,
  "currency": "INR",
  "ngo_id": 1,
  "project_id": 1,
  "payment_mode": "BANK_TRANSFER",
  "vendor_name": "Vidarbha Digital Systems Pvt Ltd",
  "invoice_number": "VDS-2024-0412",
  "status": "PENDING"
}
```
* **Validation & Features**:
  * Validates recipient NGO and confirms associated project belongs to the NGO.
  * Assigns IPFS / cryptographic receipt hash (`Qm...`).
  * If submitted with `status = "APPROVED"`, automatically debits `project.utilized_amount` and `ngo.total_funds_utilized` and generates on-chain `tx_hash`.
* **Response**: `201 Created`

---

### 2. List Expenses & Audit Filtering
* **Endpoint**: `GET /expenses/`
* **Query Parameters**:
  * `ngo_id` (integer, optional): Filter by NGO.
  * `project_id` (integer, optional): Filter by associated project initiative.
  * `status` (string, optional): `PENDING`, `APPROVED`, `FLAGGED`, `REJECTED`, `REIMBURSED`.
  * `category` (string, optional): `Hardware`, `Training`, `Materials`, `Medical`, `Logistics`, `Salaries`, `Operational`.
  * `search` (string, optional): Search keyword against title, vendor, invoice number, or receipt hash.
  * `skip` (integer, default `0`): Pagination offset.
  * `limit` (integer, default `50`): Maximum records to return.
* **Response**: `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "ngo_id": 1,
      "ngo_name": "Vidya Jyoti Foundation",
      "project_id": 1,
      "project_title": "Digital Classrooms for Rural Vidarbha",
      "title": "Classroom Tablets & Solar Chargers",
      "category": "Hardware",
      "amount": 185000.0,
      "currency": "INR",
      "payment_mode": "BANK_TRANSFER",
      "vendor_name": "Vidarbha Digital Systems Pvt Ltd",
      "invoice_number": "VDS-2024-0412",
      "status": "APPROVED",
      "is_verified": true,
      "verified_at": "2026-02-11T12:00:00Z",
      "reviewed_by": "Compliance Auditor",
      "review_notes": "All hardware physically verified and tagged in asset ledger.",
      "tx_hash": "0x99a1...104fae",
      "created_at": "2026-02-10T14:30:00Z"
    }
  ],
  "total": 1,
  "total_amount": 185000.0,
  "approved_amount": 185000.0,
  "pending_amount": 0.0,
  "skip": 0,
  "limit": 50
}
```

---

### 3. Expense Analytics & Category Breakdown
* **Endpoint**: `GET /expenses/stats/summary`
* **Query Parameters**:
  * `ngo_id` (integer, optional): Scope to a specific NGO.
  * `project_id` (integer, optional): Scope to a specific project.
* **Response**: `200 OK`
```json
{
  "total_expenses_count": 5,
  "total_amount": 502000.0,
  "approved_amount": 464000.0,
  "pending_amount": 38000.0,
  "rejected_amount": 0.0,
  "currency": "INR",
  "by_category": [
    {"category": "Hardware", "count": 1, "amount": 185000.0},
    {"category": "Medical", "count": 1, "amount": 120000.0}
  ],
  "by_project": [
    {"project_id": 1, "project_title": "Digital Classrooms for Rural Vidarbha", "count": 3, "amount": 344000.0}
  ],
  "recent_expenses": [...]
}
```

---

### 4. Update Expense Details
* **Endpoint**: `PUT /expenses/{expense_id}`
* **Request Body**: `ExpenseUpdate`
* **Response**: `200 OK`
* Allows adjusting merchant details, title, or amount. If an approved expense amount is adjusted, the change is automatically reconciled with project and NGO utilization balances.

---

### 5. Audit Review & Manage Status
* **Endpoint**: `PATCH /expenses/{expense_id}/status`
* **Request Body**: `ExpenseStatusUpdate`
```json
{
  "status": "APPROVED",
  "review_notes": "All original GST invoices and delivery challans verified against bank debits.",
  "reviewed_by": "Auditor S. Kulkarni"
}
```
* **Supported Status Lifecycle**: `PENDING` $\rightarrow$ `APPROVED` (or `REJECTED`, `FLAGGED`, `REIMBURSED`).
* **Automated Accounting**:
  * Approving an expense increments `project.utilized_amount` and `ngo.total_funds_utilized`.
  * Transitioning from `APPROVED` to `REJECTED` or `FLAGGED` reverses the utilization balances automatically.
* **Response**: `200 OK`

---

### 6. Delete Expense (Soft Delete)
* **Endpoint**: `DELETE /expenses/{expense_id}`
* **Response**: `200 OK`
* Sets `is_active = False` and rolls back utilization if previously approved.




