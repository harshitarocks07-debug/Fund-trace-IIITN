// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FundTraceLedger
 * @notice Decentralized donation and impact verification ledger.
 * Establishes an immutable, auditable connection between donated funds,
 * authorized spending, and cryptographic evidence fingerprints without exposing
 * beneficiaries' sensitive personal or financial information.
 */
contract FundTraceLedger {
    // --- Roles & Governance ---
    address public owner;
    mapping(address => bool) public authorizedAuditors;
    mapping(address => bool) public authorizedNgos;

    // --- Enums ---
    enum ExpenseStatus {
        PendingReview,   // 0
        Approved,        // 1
        Rejected,        // 2
        MoreEvidence     // 3
    }

    // --- Structs ---
    struct Project {
        string id;
        string name;
        address ngoAddress;
        uint256 budget;
        uint256 totalDonated;
        uint256 totalApprovedSpending;
        bool isActive;
        uint256 createdAt;
    }

    struct Donation {
        string id;
        string projectId;
        address donor;
        uint256 amount;
        string earmarkTag;     // e.g. "Water infrastructure", "Medical supplies"
        string paymentReference; // e.g. "PAY-8K2F19" or crypto tx reference
        uint256 timestamp;
    }

    struct ExpenseRecord {
        string id;
        string projectId;
        uint256 claimedAmount;
        bytes32 receiptHash;        // SHA-256 fingerprint of the private receipt evidence
        ExpenseStatus status;
        address auditor;            // Independent auditor address that attested the decision
        bytes32 decisionReasonHash; // Keccak-256 hash of the audit note (for integrity without PII)
        uint256 auditedAt;
        uint256 blockNumber;
        bool exists;
    }
        // --- Blockchain Payment to Invoice Linkage ---
    struct PaymentLink {
        string expenseId;
        bytes32 transactionHash;
        bytes32 invoiceHash;
        address ngoAddress;
        address vendorAddress;
        uint256 amountWei;
        uint256 linkedAt;
        bool exists;
    }

    // --- Purpose-Bound Earmark Allocation ---
    struct EarmarkCondition {
        string tag;
        uint256 allocatedAmount;
        uint256 disbursedAmount;
        bool exists;
    }

    // --- State Storage ---
    mapping(string => Project) public projects;
    string[] public projectIds;

    mapping(string => Donation) public donations;
    string[] public donationIds;

    mapping(string => ExpenseRecord) public expenses;
    string[] public expenseIds;

    // Mapping receiptHash => expenseId to detect cross-project duplicate claims on-chain
    mapping(bytes32 => string) public receiptToExpense;

    // Blockchain payment transaction <-> invoice linkage.
    mapping(string => PaymentLink) public paymentLinks;
    mapping(bytes32 => string) public transactionToExpense;

    // Purpose-Bound Allocation Tracking: projectId => earmarkTag => EarmarkCondition
    mapping(string => mapping(string => EarmarkCondition)) public earmarkConditions;

    // --- Events ---
    event ProjectRegistered(
        string indexed projectId,
        string name,
        address indexed ngoAddress,
        uint256 budget,
        uint256 timestamp
    );

    event DonationAnchored(
        string indexed donationId,
        string indexed projectId,
        address indexed donor,
        uint256 amount,
        string earmarkTag,
        string paymentReference,
        uint256 timestamp
    );

    event ExpenseAnchored(
        string indexed expenseId,
        string indexed projectId,
        uint256 claimedAmount,
        bytes32 indexed receiptHash,
        uint256 timestamp
    );

    event ExpenseAudited(
        string indexed expenseId,
        string indexed projectId,
        ExpenseStatus status,
        bytes32 indexed receiptHash,
        address auditor,
        bytes32 decisionReasonHash,
        uint256 timestamp,
        uint256 blockNumber
    );

    event ImpactProofVerified(
        string indexed projectId,
        string indexed expenseId,
        bytes32 commitmentHash,
        uint256 timestamp
    );

    event AuditorStatusUpdated(address indexed auditor, bool isAuthorized);
    event NgoStatusUpdated(address indexed ngo, bool isAuthorized);

    event PaymentInvoiceLinked(
        string indexed expenseId,
        bytes32 indexed transactionHash,
        bytes32 indexed invoiceHash,
        address ngoAddress,
        address vendorAddress,
        uint256 amountWei,
        uint256 timestamp
    );

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "FundTrace: Caller is not owner");
        _;
    }

    modifier onlyAuditor() {
        require(authorizedAuditors[msg.sender] || msg.sender == owner, "FundTrace: Caller is not authorized auditor");
        _;
    }

    modifier onlyNgoOrOwner() {
        require(authorizedNgos[msg.sender] || msg.sender == owner, "FundTrace: Caller is not authorized NGO or owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedAuditors[msg.sender] = true;
        authorizedNgos[msg.sender] = true;
    }

    // --- Admin Role Management ---
    function setAuditor(address auditor, bool status) external onlyOwner {
        require(auditor != address(0), "Invalid address");
        authorizedAuditors[auditor] = status;
        emit AuditorStatusUpdated(auditor, status);
    }

    function setNgo(address ngo, bool status) external onlyOwner {
        require(ngo != address(0), "Invalid address");
        authorizedNgos[ngo] = status;
        emit NgoStatusUpdated(ngo, status);
    }

    // --- Project Registration ---
    function registerProject(
        string calldata projectId,
        string calldata name,
        address ngoAddress,
        uint256 budget
    ) external onlyNgoOrOwner {
        require(bytes(projectId).length > 0, "Empty project ID");
        require(projects[projectId].createdAt == 0, "Project already exists");

        projects[projectId] = Project({
            id: projectId,
            name: name,
            ngoAddress: ngoAddress,
            budget: budget,
            totalDonated: 0,
            totalApprovedSpending: 0,
            isActive: true,
            createdAt: block.timestamp
        });

        projectIds.push(projectId);
        emit ProjectRegistered(projectId, name, ngoAddress, budget, block.timestamp);
    }

    // --- Donation Anchoring ---
    function anchorDonation(
        string calldata donationId,
        string calldata projectId,
        address donor,
        uint256 amount,
        string calldata earmarkTag,
        string calldata paymentReference
    ) external onlyNgoOrOwner {
        require(bytes(donationId).length > 0, "Empty donation ID");
        require(projects[projectId].createdAt > 0, "Project does not exist");
        require(donations[donationId].timestamp == 0, "Donation already recorded");
        require(amount > 0, "Amount must be positive");

        donations[donationId] = Donation({
            id: donationId,
            projectId: projectId,
            donor: donor,
            amount: amount,
            earmarkTag: earmarkTag,
            paymentReference: paymentReference,
            timestamp: block.timestamp
        });

        projects[projectId].totalDonated += amount;
        donationIds.push(donationId);

        // Record Purpose-Bound Allocation Condition
        if (bytes(earmarkTag).length > 0) {
            EarmarkCondition storage ec = earmarkConditions[projectId][earmarkTag];
            ec.tag = earmarkTag;
            ec.allocatedAmount += amount;
            ec.exists = true;
        }

        emit DonationAnchored(
            donationId,
            projectId,
            donor,
            amount,
            earmarkTag,
            paymentReference,
            block.timestamp
        );
    }

    /**
     * @notice Enforces agreed disbursement conditions on purpose-bound funds:
     * 1. Project must be active.
     * 2. Total spending cannot exceed allocated budget.
     * 3. Earmark tag allocation must have sufficient balance.
     */
    function verifyDisbursementCondition(
        string calldata projectId,
        string calldata earmarkTag,
        uint256 claimedAmount
    ) external view returns (bool approved, string memory reason) {
        Project memory p = projects[projectId];
        if (p.createdAt == 0) return (false, "Project does not exist");
        if (!p.isActive) return (false, "Project is not active");
        if (p.totalApprovedSpending + claimedAmount > p.budget) {
            return (false, "Disbursement exceeds total project budget");
        }
        if (bytes(earmarkTag).length > 0 && earmarkConditions[projectId][earmarkTag].exists) {
            EarmarkCondition memory ec = earmarkConditions[projectId][earmarkTag];
            if (ec.disbursedAmount + claimedAmount > ec.allocatedAmount) {
                return (false, "Disbursement exceeds purpose-bound earmark allocation");
            }
        }
        return (true, "Disbursement conditions satisfied");
    }

    // --- Expense & Evidence Commitment Anchoring ---
    /**
     * @notice Records an auditor-verified expense and anchors the cryptographic receipt fingerprint on-chain.
     * @param expenseId Unique identifier of the expense claim (e.g. "EXP-001")
     * @param projectId Project to which the expense is charged
     * @param claimedAmount Amount authorized
     * @param receiptHash SHA-256 digest of the off-chain invoice evidence
     * @param status Audit review status (1 = Approved, 2 = Rejected, 3 = MoreEvidence)
     * @param decisionReasonHash Keccak-256 hash of the auditor's rationale
     */
    function anchorExpenseAudit(
        string calldata expenseId,
        string calldata projectId,
        uint256 claimedAmount,
        bytes32 receiptHash,
        ExpenseStatus status,
        bytes32 decisionReasonHash
    ) external onlyAuditor {
        require(bytes(expenseId).length > 0, "Empty expense ID");
        require(projects[projectId].createdAt > 0, "Project does not exist");
        require(receiptHash != bytes32(0), "Empty receipt hash");

        // Duplicate prevention check: if receipt was already tied to another expense
        string memory existingExpense = receiptToExpense[receiptHash];
        if (bytes(existingExpense).length > 0) {
            require(
                keccak256(bytes(existingExpense)) == keccak256(bytes(expenseId)),
                "Duplicate evidence: Receipt hash already anchored to another claim"
            );
        } else {
            receiptToExpense[receiptHash] = expenseId;
        }

        bool isNew = !expenses[expenseId].exists;

        expenses[expenseId] = ExpenseRecord({
            id: expenseId,
            projectId: projectId,
            claimedAmount: claimedAmount,
            receiptHash: receiptHash,
            status: status,
            auditor: msg.sender,
            decisionReasonHash: decisionReasonHash,
            auditedAt: block.timestamp,
            blockNumber: block.number,
            exists: true
        });

        if (isNew) {
            expenseIds.push(expenseId);
            emit ExpenseAnchored(expenseId, projectId, claimedAmount, receiptHash, block.timestamp);
        }

        if (status == ExpenseStatus.Approved) {
            projects[projectId].totalApprovedSpending += claimedAmount;
        }

        emit ExpenseAudited(
            expenseId,
            projectId,
            status,
            receiptHash,
            msg.sender,
            decisionReasonHash,
            block.timestamp,
            block.number
        );

        // Compute and emit impact proof commitment: H(projectId || expenseId || receiptHash || auditor)
        bytes32 commitment = keccak256(
            abi.encodePacked(projectId, expenseId, receiptHash, msg.sender, block.timestamp)
        );
        emit ImpactProofVerified(projectId, expenseId, commitment, block.timestamp);
    }

    // --- Blockchain Payment to Invoice Linkage ---

    /**
     * @notice Records a link between an existing expense's invoice hash and a
     * blockchain payment transaction. The backend must validate the transaction
     * receipt, chain ID, sender, recipient, and amount before calling this function.
     * @dev This contract records the attestation; it does not independently inspect
     * a transaction on another chain or prove that the invoice is genuine.
     */
    function linkPaymentToInvoice(
        string calldata expenseId,
        bytes32 transactionHash,
        bytes32 invoiceHash,
        address ngoAddress,
        address vendorAddress,
        uint256 amountWei
    ) external onlyNgoOrOwner {
        require(bytes(expenseId).length > 0, "Empty expense ID");
        require(expenses[expenseId].exists, "Expense does not exist");
        require(transactionHash != bytes32(0), "Empty transaction hash");
        require(invoiceHash != bytes32(0), "Empty invoice hash");
        require(expenses[expenseId].receiptHash == invoiceHash, "Invoice hash does not match expense");
        require(ngoAddress != address(0), "Invalid NGO address");
        require(vendorAddress != address(0), "Invalid vendor address");
        require(ngoAddress != vendorAddress, "NGO and vendor must differ");
        require(amountWei > 0, "Amount must be positive");
        require(msg.sender == owner || msg.sender == ngoAddress, "Caller must be paying NGO or owner");
        require(msg.sender == owner || authorizedNgos[ngoAddress], "NGO is not authorized");
        require(!paymentLinks[expenseId].exists, "Payment already linked to expense");

        string memory existingExpense = transactionToExpense[transactionHash];
        require(bytes(existingExpense).length == 0, "Transaction already linked to another expense");

        paymentLinks[expenseId] = PaymentLink({
            expenseId: expenseId,
            transactionHash: transactionHash,
            invoiceHash: invoiceHash,
            ngoAddress: ngoAddress,
            vendorAddress: vendorAddress,
            amountWei: amountWei,
            linkedAt: block.timestamp,
            exists: true
        });
        transactionToExpense[transactionHash] = expenseId;

        emit PaymentInvoiceLinked(
            expenseId,
            transactionHash,
            invoiceHash,
            ngoAddress,
            vendorAddress,
            amountWei,
            block.timestamp
        );
    }

    /**
     * @notice Verifies that the supplied transaction and invoice hashes match
     * the recorded linkage for an expense.
     */
    function verifyPaymentInvoiceLink(
        string calldata expenseId,
        bytes32 transactionHash,
        bytes32 invoiceHash
    ) external view returns (
        bool matches,
        address ngoAddress,
        address vendorAddress,
        uint256 amountWei,
        uint256 linkedAt
    ) {
        PaymentLink memory link = paymentLinks[expenseId];
        if (!link.exists) {
            return (false, address(0), address(0), 0, 0);
        }

        bool isMatch = link.transactionHash == transactionHash && link.invoiceHash == invoiceHash;
        return (isMatch, link.ngoAddress, link.vendorAddress, link.amountWei, link.linkedAt);
    }

    // --- Public Verification View Functions ---
    /**
     * @notice Allows donors or auditors to verify whether an off-chain receipt file
     * matches the exact cryptographic seal committed on-chain.
     * Keeps beneficiary details 100% private.
     */
    function verifyReceiptCommitment(
        string calldata expenseId,
        bytes32 presentedReceiptHash
    ) external view returns (
        bool matches,
        ExpenseStatus status,
        address auditor,
        uint256 claimedAmount,
        uint256 auditedAt,
        uint256 blockNumber
    ) {
        ExpenseRecord memory record = expenses[expenseId];
        if (!record.exists) {
            return (false, ExpenseStatus.PendingReview, address(0), 0, 0, 0);
        }

        bool isMatch = (record.receiptHash == presentedReceiptHash);
        return (
            isMatch,
            record.status,
            record.auditor,
            record.claimedAmount,
            record.auditedAt,
            record.blockNumber
        );
    }

    function getProjectSummary(string calldata projectId) external view returns (
        string memory name,
        uint256 budget,
        uint256 totalDonated,
        uint256 totalApprovedSpending,
        bool isActive
    ) {
        Project memory p = projects[projectId];
        require(p.createdAt > 0, "Project not found");
        return (p.name, p.budget, p.totalDonated, p.totalApprovedSpending, p.isActive);
    }

    function getExpenseCount() external view returns (uint256) {
        return expenseIds.length;
    }

    function getProjectCount() external view returns (uint256) {
        return projectIds.length;
    }
}

