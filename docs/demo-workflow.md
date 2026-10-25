# FundTrace - End-to-End Demo Workflow

This guide walks through testing and demonstrating all platform modules in FundTrace, covering NGO management, project creation, budget definition, donation recording, and expenditure tracking.

---

## 1. Quickstart

### Backend Setup & Launch
```powershell
cd backend
# Activate virtual environment
.\.venv\Scripts\Activate.ps1
# Run FastAPI server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Swagger UI will be accessible at: `http://127.0.0.1:8000/docs`

### Frontend Setup & Launch
```powershell
cd frontend
npm run dev
```
Vite dev server will be accessible at: `http://localhost:5173`

---

## 2. Running Automated Tests

To run the backend test suite:
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/ -v
```
**Expected Result**: All 33 tests pass (`test_ngo.py`, `test_project.py`, `test_donation.py`, `test_expense.py`).

To verify frontend TypeScript compilation and production bundle:
```powershell
cd frontend
npm run build
```

---

## 3. End-to-End Project Demo Steps

### Step 1: Browse Existing Projects & Budgets
1. Open the FundTrace application in your browser (`http://localhost:5173`).
2. Navigate to **"🚀 Projects & Budgets"** in the top navigation bar.
3. Observe key aggregated metrics:
   - **Total Projects**: Count of registered initiatives across all NGOs.
   - **Active Projects**: Currently executing initiatives.
   - **Total Budget Target**: Cumulative capital required across initiatives.
   - **Total Funds Raised & Utilized**: Real-time progress and expenditure rates.
4. Filter by status (`Active`, `Planning`, `Completed`, `Paused`, `Cancelled`) or search by keyword (e.g., `Classrooms`, `Solar`, `Clinic`).

### Step 2: Create a New Project & Define Budget
1. Click the **"+ Create Project"** button in the header.
2. Fill in the initiative details:
   - **Project Title**: e.g., `Rural Clean Water Filtration Project`
   - **Managing NGO**: Select an NGO (e.g., `Vidya Jyoti Foundation`)
   - **Category**: `Clean Water` / `Sanitation`
   - **Initial Status**: `Planning`
   - **Target Budget**: `₹750,000`
   - **Target Beneficiaries**: `3,000`
   - **Milestones**: Add milestone titles and target dates.
3. Click **"Save Initiative"**.
4. The new project card appears instantly with 0% funding and utilization.

### Step 3: Track Project Status Lifecycle
1. On any project card, click **"⚡ Status"**.
2. Transition the status:
   - From `PLANNING` $\rightarrow$ `ACTIVE`
   - Note: Changing status to `ACTIVE` automatically updates the managing NGO's active project counter.
   - Transition to `COMPLETED` when all milestones are achieved.
3. Observe the dynamic status badge and lifecycle state updates in the UI.

### Step 4: Update Budget & Record Expenditures
1. On an active project, click **"💰 Edit Budget"**.
2. Update the `Target Budget`, `Raised Amount`, or `Utilized Amount`.
3. The card immediately updates both interactive progress bars:
   - **Funding Progress Bar** (Raised / Target)
   - **Utilization Progress Bar** (Utilized / Raised)
4. Click **"📊 Breakdown"** to view real-time calculated financial metrics:
   - `Funding Gap = Target Budget - Raised Amount`
   - `Remaining Funds in Reserve = Raised Amount - Utilized Amount`
   - Milestone checklist and execution status.

---

## 4. End-to-End Donation Management Demo Steps

### Step 1: Access the Ledger & Donation Metrics
1. In the application navbar, click **"💝 Donations & Ledger"**.
2. Observe key aggregated donation metrics:
   - **Total Raised**: Cumulative verified capital contributed across all campaigns.
   - **Total Contributions**: Blockchain-verified transaction count.
   - **Average Gift**: Mean donation size.
   - **Projects Directly Funded**: Count of initiatives receiving dedicated capital.
3. Review the interactive **Donation Trends & Flow Analysis** bar chart.

### Step 2: Record a Contribution & Associate with a Project
1. Click the **"💝 Record New Donation"** button in the top right.
2. Fill in the donation form:
   - **Donor Name**: e.g., `Tata Community Development Trust`
   - **Donor Email**: e.g., `csr@tatatrusts.org`
   - **Donor PAN**: e.g., `AAATT0192M` (for 80G tax receipt)
   - **Amount**: `₹250,000`
   - **Recipient NGO**: Select an NGO (e.g. `Vidya Jyoti Foundation`)
   - **Associate with Project Initiative**: Select an initiative, e.g., `🚀 Digital Classrooms for Rural Vidarbha`.
   - **Payment Method**: Select `Bank Wire / NEFT / RTGS` or `UPI`.
   - **Purpose / Memo**: e.g., `Phase 2 tablet laboratory sponsorship`.
3. Click **"Confirm & Record Donation"**.
4. The ledger updates instantly:
   - An on-chain simulated `tx_hash` (e.g., `0x3a12...9f4b`) is minted.
   - An official receipt number (e.g., `REC-20261025-XXX`) is assigned.
   - The associated project's raised balance and the NGO's total funds received automatically increase by `₹250,000`!

### Step 3: Filter Ledger by Associated Project
1. In the filters bar, click the **"Project"** dropdown and select `🚀 Digital Classrooms for Rural Vidarbha`.
2. The table filters immediately to show only contributions funding that specific initiative.
3. Switch payment method to `UPI` or `Bank Transfer` to isolate specific payment rails.

### Step 4: Generate & Print Section 80G Tax Receipt
1. On any contribution row in the ledger table, click **"🧾 80G Receipt"**.
2. An official, printable Section 80G tax exemption receipt modal opens displaying:
   - Issuing NGO name, registration certificate number, and NITI Aayog Darpan ID.
   - Section 80G compliant badge.
   - Donor name and validated PAN.
   - Directly associated project initiative title.
   - Verified on-chain transaction hash and tamper-proof verification stamp.
3. Click **"🖨️ Print / Download PDF"** to trigger the browser print dialog.

---

## 5. End-to-End Expense Management Demo Steps

### Step 1: Browse Expenditures & Audit Metrics
1. In the top navigation bar, click **"💸 Expenses & Audit"**.
2. Observe key aggregated expenditure metrics:
   - **Total Utilization**: Aggregate value of all submitted vendor bills.
   - **Verified & Disbursed**: Approved expenses actively debited from platform balances.
   - **Pending Verification**: Submitted bills waiting for auditor sign-off.
   - **Top Expense Sector**: Category with the highest utilization.
3. Filter by status (`ALL`, `PENDING`, `APPROVED`, `FLAGGED`), project initiative, or category (`Hardware`, `Training`, `Materials`, `Medical`).

### Step 2: Submit a Vendor Invoice & Associate with Project
1. Click **"+ Submit New Expense"** in the top right.
2. Fill in the expenditure form:
   - **Title / Purpose**: e.g., `Solar Batteries and Power Stabilizers`
   - **Amount**: `₹45,000`
   - **Category**: `Hardware`
   - **Managing NGO**: `Vidya Jyoti Foundation`
   - **Debit Project Budget**: Select `🚀 Digital Classrooms for Rural Vidarbha`
   - **Vendor Name**: e.g., `Vidarbha Renewable Energy Ltd`
   - **Invoice Number**: e.g., `VRE-2026-441`
   - **Payment Mode**: `Bank Wire / RTGS / NEFT`
3. Click **"Submit Expenditure"**.
4. The expense is created in `PENDING` status. Because it is pending, it does not debit project funds until audited.

### Step 3: Audit Review & Manage Status Workflow
1. On the newly created expenditure, click the **"⚡ Status"** button.
2. The audit review modal opens. Select **"✅ APPROVED"**.
3. Enter auditor remarks: `Tax invoice verified with GST portal and physical equipment inspection confirmed.`
4. Click **"Confirm Audit Status"**.
5. The ledger immediately updates:
   - Status switches to **APPROVED** with an on-chain transaction hash (`0x...`).
   - The associated project's `utilized_amount` and the NGO's `total_funds_utilized` automatically increment by `₹45,000`!
6. If the auditor later switches status to **REJECTED** or **FLAGGED**, the utilization balances automatically decrement back to preserve audit integrity.

### Step 4: View Full Expense Voucher & Receipt Hash
1. Click the **"👁️"** button on any expenditure row.
2. View the comprehensive audit voucher containing the itemized description, merchant details, payment mode, IPFS receipt hash, reviewer identity, and audit remarks.
