# FundTrace Database Schema

## NGO Management Schema

The Non-Governmental Organization (NGO) entity is the central actor in the FundTrace platform. NGOs manage organizational profiles, register compliance documents, post impact metrics, and provide bank and blockchain wallet details for transparent end-to-end fund tracing.

### Entity: `ngos` (Non-Governmental Organizations)

| Column Name | Data Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique internal identifier for the NGO profile |
| `user_id` | `INTEGER` | `FOREIGN KEY (users.id) NULLABLE` | Link to the primary administrative user account |
| `name` | `VARCHAR(255)` | `NOT NULL, INDEXED` | Display and working name of the non-profit |
| `legal_name` | `VARCHAR(255)` | `NULLABLE` | Official name registered under Societies / Trust Act |
| `registration_number` | `VARCHAR(100)` | `UNIQUE, NOT NULL, INDEXED` | Government certificate of registration number |
| `darpan_id` | `VARCHAR(100)` | `UNIQUE, NULLABLE, INDEXED` | NITI Aayog NGO Darpan unique identity number |
| `pan_number` | `VARCHAR(20)` | `NULLABLE` | Permanent Account Number for Indian Income Tax |
| `category` | `VARCHAR(100)` | `NOT NULL, DEFAULT 'Education'` | Primary cause/sector (Education, Healthcare, Environment, etc.) |
| `mission` | `TEXT` | `NULLABLE` | Core organizational mission statement |
| `vision` | `TEXT` | `NULLABLE` | Long-term organizational vision |
| `description` | `TEXT` | `NULLABLE` | Detailed description of operations and background |
| `founding_year` | `INTEGER` | `NULLABLE` | Calendar year of establishment |
| `contact_email` | `VARCHAR(255)` | `NOT NULL` | Official communication email |
| `contact_phone` | `VARCHAR(50)` | `NOT NULL` | Official phone / helpline number |
| `website` | `VARCHAR(255)` | `NULLABLE` | URL to public website |
| `logo_url` | `VARCHAR(500)` | `NULLABLE` | Brand logo image link |
| `cover_image_url` | `VARCHAR(500)` | `NULLABLE` | Header banner image link |
| `address` | `VARCHAR(255)` | `NULLABLE` | Street and office address |
| `city` | `VARCHAR(100)` | `NULLABLE, INDEXED` | Headquarters city |
| `state` | `VARCHAR(100)` | `NULLABLE, INDEXED` | State or province |
| `pincode` | `VARCHAR(20)` | `NULLABLE` | Postal PIN code |
| `country` | `VARCHAR(100)` | `DEFAULT 'India'` | Operating country |
| `operating_regions` | `TEXT` | `NULLABLE` | Comma-separated or JSON list of target districts/regions |
| `bank_name` | `VARCHAR(150)` | `NULLABLE` | Authorized partner commercial bank |
| `bank_account_number`| `VARCHAR(50)` | `NULLABLE` | Bank account number for fund disbursement |
| `bank_ifsc` | `VARCHAR(30)` | `NULLABLE` | Indian Financial System Code for bank branch |
| `wallet_address` | `VARCHAR(66)` | `NULLABLE, INDEXED` | Public Ethereum / Polygon wallet address for smart contract ledger |
| `verification_status`| `VARCHAR(50)` | `DEFAULT 'PENDING'` | Lifecycle: `PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED` |
| `verification_notes` | `TEXT` | `NULLABLE` | Auditor justification or compliance deficiency details |
| `verified_at` | `DATETIME` | `NULLABLE` | Timestamp when certification was granted |
| `verified_by_user_id`| `INTEGER` | `NULLABLE` | Auditor ID who reviewed and verified the organization |
| `has_80g_certificate`| `BOOLEAN` | `DEFAULT FALSE` | Income Tax 80G tax exemption active status |
| `has_12a_certificate`| `BOOLEAN` | `DEFAULT FALSE` | Income Tax 12A trust registration active status |
| `has_fcra_registration`| `BOOLEAN` | `DEFAULT FALSE` | Ministry of Home Affairs FCRA international grant authorization |
| `fcra_number` | `VARCHAR(50)` | `NULLABLE` | FCRA registration certificate number |
| `transparency_score`| `FLOAT` | `DEFAULT 75.0` | Dynamic score (0-100) computed from documentation & audit reports |
| `total_funds_received`| `FLOAT` | `DEFAULT 0.0` | Cumulative donations verified on platform |
| `total_funds_utilized`| `FLOAT` | `DEFAULT 0.0` | Cumulative audited expenses recorded |
| `active_projects_count`| `INTEGER` | `DEFAULT 0` | Count of active ongoing programs |
| `beneficiaries_count`| `INTEGER` | `DEFAULT 0` | Total quantified impact headcount |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Soft-deletion flag |
| `created_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Profile creation timestamp |
| `updated_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Last profile update timestamp |

---

### Entity: `users`

| Column Name | Data Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | User ID |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL` | Login email |
| `hashed_password` | `VARCHAR(255)` | `NOT NULL` | Bcrypt hashed credential |
| `full_name` | `VARCHAR(255)` | `NULLABLE` | User's full name |
| `role` | `VARCHAR(50)` | `DEFAULT 'ngo'` | Roles: `ngo`, `admin`, `auditor`, `donor` |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Account state |
| `is_verified` | `BOOLEAN` | `DEFAULT FALSE` | Email/identity verification |
| `created_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Last updated |

---

## Project Management Schema

Projects represent actionable initiatives executed by NGOs. Each project defines an approved budget target, tracks raised contributions, logs utilized/spent funds, and monitors project lifecycle statuses and milestones.

### Entity: `projects` (Initiatives & Budgets)

| Column Name | Data Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique identifier for the project |
| `ngo_id` | `INTEGER` | `FOREIGN KEY (ngos.id), NOT NULL, INDEXED` | Reference to managing NGO profile |
| `title` | `VARCHAR(255)` | `NOT NULL, INDEXED` | Short descriptive title of the initiative |
| `description` | `TEXT` | `NOT NULL` | In-depth description and mission of the project |
| `category` | `VARCHAR(100)` | `NOT NULL, DEFAULT 'General'` | Domain sector (Education, Health, Clean Water, etc.) |
| `target_budget` | `FLOAT` | `NOT NULL` | Total approved budget required for execution |
| `raised_amount` | `FLOAT` | `DEFAULT 0.0` | Total confirmed contributions received to date |
| `utilized_amount` | `FLOAT` | `DEFAULT 0.0` | Total audited funds expended/disbursed |
| `currency` | `VARCHAR(10)` | `DEFAULT 'INR'` | Denominated currency code (`INR`, `USD`, `EUR`) |
| `status` | `VARCHAR(50)` | `DEFAULT 'PLANNING', INDEXED` | Lifecycle status: `PLANNING`, `ACTIVE`, `COMPLETED`, `PAUSED`, `CANCELLED` |
| `start_date` | `DATE` | `NULLABLE` | Scheduled or actual commencement date |
| `end_date` | `DATE` | `NULLABLE` | Scheduled or actual conclusion date |
| `location` | `VARCHAR(255)` | `NULLABLE` | Target execution geography (city, district, village) |
| `beneficiaries_target`| `INTEGER` | `DEFAULT 0` | Target direct beneficiaries to be impacted |
| `beneficiaries_reached`| `INTEGER` | `DEFAULT 0` | Actual quantified beneficiaries supported |
| `wallet_address` | `VARCHAR(66)` | `NULLABLE` | Dedicated smart contract or multi-sig wallet address |
| `milestones` | `TEXT` | `NULLABLE` | JSON-serialized roadmap of milestones and deliverables |
| `cover_image_url` | `VARCHAR(500)` | `NULLABLE` | Public initiative promotional banner image |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Soft-deletion flag |
| `created_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Project creation timestamp |
| `updated_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

### Relationships
- **NGO $\rightarrow$ Projects**: One-to-Many (`NGO.projects = relationship("Project", back_populates="ngo", cascade="all, delete-orphan")`).
- Deleting an NGO automatically cascades to its project records.
- Creating, transitioning, or deleting an `ACTIVE` project dynamically updates `NGO.active_projects_count`.

---

## Donation Management Schema

Donations represent individual or institutional contributions directed toward an NGO's general corpus or directly associated with an active project initiative. Each donation is timestamped, verified on-chain, and eligible for Section 80G tax receipt generation.

### Entity: `donations` (Contributions & Ledger)

| Column Name | Data Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique identifier for donation record |
| `ngo_id` | `INTEGER` | `FOREIGN KEY (ngos.id), NOT NULL, INDEXED` | Recipient NGO profile |
| `project_id` | `INTEGER` | `FOREIGN KEY (projects.id) NULLABLE, INDEXED` | Associated Project initiative (or `NULL` for General Fund) |
| `donor_name` | `VARCHAR(255)` | `NOT NULL, INDEXED` | Full name of donor or institutional CSR trust |
| `donor_email` | `VARCHAR(255)` | `NULLABLE` | Contact email for receipt delivery |
| `donor_pan` | `VARCHAR(20)` | `NULLABLE` | Indian Income Tax PAN for Section 80G tax certificate |
| `is_anonymous` | `BOOLEAN` | `DEFAULT FALSE` | Privacy flag to mask donor identity publicly |
| `amount` | `FLOAT` | `NOT NULL` | Donated monetary amount ($> 0$) |
| `currency` | `VARCHAR(10)` | `DEFAULT 'INR'` | Denominated currency code (`INR`, `USD`) |
| `payment_method` | `VARCHAR(50)` | `DEFAULT 'UPI'` | Method: `UPI`, `CARD`, `BANK_TRANSFER`, `CRYPTO`, `CHEQUE` |
| `status` | `VARCHAR(50)` | `DEFAULT 'CONFIRMED', INDEXED` | Lifecycle status: `PENDING`, `CONFIRMED`, `FAILED`, `REFUNDED` |
| `tx_hash` | `VARCHAR(100)` | `UNIQUE, NULLABLE, INDEXED` | Cryptographic blockchain transaction hash or bank UTR |
| `block_number` | `INTEGER` | `NULLABLE` | Simulated or EVM ledger block height |
| `receipt_number` | `VARCHAR(50)` | `UNIQUE, NULLABLE, INDEXED` | Generated Section 80G tax exemption receipt number |
| `tax_benefit_claimed`| `BOOLEAN` | `DEFAULT FALSE` | Flag indicating 80G tax deduction claim status |
| `notes` | `TEXT` | `NULLABLE` | Donor memo or designated grant allocation purpose |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Soft-deletion flag |
| `created_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP, INDEXED` | Timestamp of contribution |
| `updated_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

### Relationships & Balance Automation
- **NGO $\rightarrow$ Donations**: One-to-Many (`NGO.donations = relationship("Donation", back_populates="ngo", cascade="all, delete-orphan")`).
- **Project $\rightarrow$ Donations**: One-to-Many (`Project.donations = relationship("Donation", back_populates="project")`).
- **Automated Financial Tracking**:
  - When a `CONFIRMED` donation is recorded with a `project_id`, `project.raised_amount` and `ngo.total_funds_received` are automatically incremented.
  - If a confirmed donation is soft deleted, the associated project and NGO raised totals are rolled back.

---

## Expense Management Schema

Expenses represent itemized operational, procurement, and field expenditures incurred by an NGO. Each expense is categorized, associated with an active project initiative, backed by vendor invoices or receipt hashes, and evaluated through compliance status workflows (`PENDING`, `APPROVED`, `FLAGGED`, `REJECTED`).

### Entity: `expenses` (Utilization & Invoices)

| Column Name | Data Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique identifier for expense record |
| `ngo_id` | `INTEGER` | `FOREIGN KEY (ngos.id), NOT NULL, INDEXED` | Incurring NGO profile |
| `project_id` | `INTEGER` | `FOREIGN KEY (projects.id) NULLABLE, INDEXED` | Associated Project initiative (or `NULL` for General Fund) |
| `title` | `VARCHAR(255)` | `NOT NULL, INDEXED` | Descriptive title of expenditure |
| `description` | `TEXT` | `NULLABLE` | Detailed breakdown or operational justification |
| `category` | `VARCHAR(100)` | `NOT NULL, INDEXED` | Sector: `Hardware`, `Training`, `Materials`, `Medical`, `Logistics`, `Salaries`, `Operational`, `Services` |
| `amount` | `FLOAT` | `NOT NULL` | Expense cost ($> 0$) |
| `currency` | `VARCHAR(10)` | `DEFAULT 'INR'` | Denominated currency |
| `payment_mode` | `VARCHAR(50)` | `DEFAULT 'BANK_TRANSFER'` | Mode: `BANK_TRANSFER`, `UPI`, `CARD`, `CHEQUE`, `CASH` |
| `vendor_name` | `VARCHAR(255)` | `NULLABLE` | Supplier, contractor, or merchant name |
| `invoice_number` | `VARCHAR(100)` | `NULLABLE, INDEXED` | Merchant tax invoice or bill number |
| `invoice_date` | `DATETIME` | `NULLABLE` | Date on merchant bill |
| `receipt_hash` | `VARCHAR(100)` | `NULLABLE` | IPFS CID or cryptographic hash of uploaded bill |
| `receipt_url` | `VARCHAR(500)` | `NULLABLE` | Storage path or URL to invoice proof document |
| `status` | `VARCHAR(50)` | `DEFAULT 'PENDING', INDEXED` | Lifecycle status: `PENDING`, `APPROVED`, `REJECTED`, `FLAGGED`, `REIMBURSED` |
| `is_verified` | `BOOLEAN` | `DEFAULT FALSE` | True once verified and approved by auditor |
| `verified_at` | `DATETIME` | `NULLABLE` | Timestamp when auditor approved the expense |
| `reviewed_by` | `VARCHAR(255)` | `NULLABLE` | Auditor or reviewer identity |
| `review_notes` | `TEXT` | `NULLABLE` | Auditor justifications or compliance deficiency notes |
| `tx_hash` | `VARCHAR(100)` | `NULLABLE, INDEXED` | On-chain disbursement or verification hash |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Soft-deletion flag |
| `created_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP, INDEXED` | Creation timestamp |
| `updated_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

### Relationships & Balance Automation
- **NGO $\rightarrow$ Expenses**: One-to-Many (`NGO.expenses = relationship("Expense", back_populates="ngo", cascade="all, delete-orphan")`).
- **Project $\rightarrow$ Expenses**: One-to-Many (`Project.expenses = relationship("Expense", back_populates="project")`).
- **Automated Financial Tracking**:
  - When an expense transitions to `APPROVED` or `REIMBURSED`, `project.utilized_amount` and `ngo.total_funds_utilized` are automatically incremented.
  - When an expense transitions away from `APPROVED` (e.g. to `REJECTED`, `FLAGGED`, or soft-deleted), the project and NGO utilized totals are rolled back.




