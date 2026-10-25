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

    // --- Privacy-Preserving Zero-PII Donation Commitments ---
    // Sensitive personal information (donor name, email, phone number, internal donor ID,
    // donation reference, and private blinding salt) is kept exclusively in the private backend database.
    // The smart contract stores only the cryptographic commitment and project association.
    // Individual donation amounts and precise timestamps are NOT stored in commitment records
    // or emitted in events, shielding donors from correlation and de-anonymization attacks.
    struct DonationCommitment {
        string id;                 // Opaque donation identifier (e.g. "DON-001"), never the internal database ID
        string projectId;          // Associated project
        bytes32 commitmentHash;    // keccak256(donationId || projectId || amount || paymentReference || blindingSalt)
        uint256 blockNumber;       // Coarse block number for ordering (no second-precision timestamps)
        bool exists;
    }

    // --- State Storage ---
    mapping(string => Project) public projects;
    string[] public projectIds;

    mapping(string => Donation) public donations;
    string[] public donationIds;

    mapping(string => DonationCommitment) public donationCommitments;
    string[] public donationCommitmentIds;
    mapping(bytes32 => string) public commitmentToDonation;

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

    event DonationCommitmentAnchored(
        string indexed donationId,
        string indexed projectId,
        bytes32 indexed commitmentHash,
        uint256 blockNumber
    );

    event DonationPaymentVerified(
        string indexed donationId,
        bytes32 indexed paymentTxHash,
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

    // --- Legacy / Deprecated Donation Anchoring ---
    /**
     * @notice DEPRECATED: Recording plain donor addresses, payment references, or raw
     * personal information on-chain violates Zero-PII privacy requirements.
     * All donations must use anchorDonationCommitment instead.
     */
    function anchorDonation(
        string calldata,
        string calldata,
        address,
        uint256,
        string calldata,
        string calldata
    ) external pure {
        revert("Deprecated: Use anchorDonationCommitment to ensure zero-PII storage");
    }

    /**
     * @notice Updates the public financial aggregate for a project.
     * Allows project-level financial transparency without publishing individual donor
     * contribution amounts or timing.
     */
    function recordProjectDonationAggregate(
        string calldata projectId,
        uint256 aggregateAmount
    ) external onlyNgoOrOwner {
        require(projects[projectId].createdAt > 0, "Project does not exist");
        projects[projectId].totalDonated += aggregateAmount;
    }

    /**
     * @notice Anchors a privacy-preserving donation commitment on-chain.
     * Keeps donor names, emails, phone numbers, internal donor IDs, donation references,
     * individual amounts, and precise timestamps strictly off-chain in the private database.
     * Maintains public transparency solely through project-level financial aggregates.
     *
     * @param donationId Unique opaque donation identifier (e.g. "DON-001"), NEVER internal user ID
     * @param projectId Associated project ID
     * @param aggregateAmount Donated currency amount (increments project aggregate only, NOT stored in commitment record)
     * @param commitmentHash Keccak-256 commitment: H(donationId || projectId || amount || paymentReference || blindingSalt)
     */
    function anchorDonationCommitment(
        string calldata donationId,
        string calldata projectId,
        uint256 aggregateAmount,
        bytes32 commitmentHash
    ) external onlyNgoOrOwner {
        require(bytes(donationId).length > 0, "Empty donation ID");
        require(projects[projectId].createdAt > 0, "Project does not exist");
        require(commitmentHash != bytes32(0), "Empty commitment hash");
        require(!donationCommitments[donationId].exists, "Donation commitment already recorded");
        require(bytes(commitmentToDonation[commitmentHash]).length == 0, "Duplicate commitment hash");

        // The commitment record on-chain intentionally omits individual amounts and precise timestamps
        // to protect against linkage and correlation attacks.
        donationCommitments[donationId] = DonationCommitment({
            id: donationId,
            projectId: projectId,
            commitmentHash: commitmentHash,
            blockNumber: block.number,
            exists: true
        });

        commitmentToDonation[commitmentHash] = donationId;
        donationCommitmentIds.push(donationId);

        // Update project-level financial aggregate publicly
        if (aggregateAmount > 0) {
            projects[projectId].totalDonated += aggregateAmount;
        }

        // Public event contains NO PII, NO individual amount, and NO second-level timestamp
        emit DonationCommitmentAnchored(
            donationId,
            projectId,
            commitmentHash,
            block.number
        );
    }

    /**
     * @notice Variant for strict calldata confidentiality:
     * Anchors commitment without specifying any amount in transaction calldata.
     */
    function anchorDonationCommitmentBlinded(
        string calldata donationId,
        string calldata projectId,
        bytes32 commitmentHash
    ) external onlyNgoOrOwner {
        _anchorDonationCommitmentWithoutAmount(
            donationId,
            projectId,
            commitmentHash
        );
    }



    function _anchorDonationCommitmentWithoutAmount(
        string memory donationId,
        string memory projectId,
        bytes32 commitmentHash
    ) private {
        require(bytes(donationId).length > 0, "Empty donation ID");
        require(projects[projectId].createdAt > 0, "Project does not exist");
        require(commitmentHash != bytes32(0), "Empty commitment hash");
        require(!donationCommitments[donationId].exists, "Donation commitment already recorded");
        require(bytes(commitmentToDonation[commitmentHash]).length == 0, "Duplicate commitment hash");

        donationCommitments[donationId] = DonationCommitment({
            id: donationId,
            projectId: projectId,
            commitmentHash: commitmentHash,
            blockNumber: block.number,
            exists: true
        });

        commitmentToDonation[commitmentHash] = donationId;
        donationCommitmentIds.push(donationId);

        emit DonationCommitmentAnchored(
            donationId,
            projectId,
            commitmentHash,
            block.number
        );
    }

    /**
     * @notice Allows authorized parties to verify a donation record commitment without publishing donor PII.
     * Does not expose individual donation amounts or timestamps from contract storage.
     * @param donationId The donation identifier
     * @param presentedCommitmentHash The cryptographic commitment presented for verification
     */
    function verifyDonationCommitment(
        string calldata donationId,
        bytes32 presentedCommitmentHash
    ) external view returns (
        bool matches,
        string memory projectId,
        uint256 blockNumber
    ) {
        DonationCommitment memory record = donationCommitments[donationId];
        if (!record.exists) {
            return (false, "", 0);
        }
        bool isMatch = (record.commitmentHash == presentedCommitmentHash);
        return (
            isMatch,
            record.projectId,
            record.blockNumber
        );
    }

    /**
     * @notice Verifies donation credentials against on-chain commitment without revealing donor identity.
     * Dynamically verifies Keccak-256(donationId || projectId || amount || paymentReference || blindingSalt)
     * without storing any sensitive preimages in contract storage.
     */
    function verifyDonationPreimage(
        string calldata donationId,
        string calldata projectId,
        uint256 amount,
        string calldata paymentReference,
        bytes32 blindingSalt
    ) external view returns (
        bool valid,
        uint256 blockNumber
    ) {
        DonationCommitment memory record = donationCommitments[donationId];
        if (!record.exists) {
            return (false, 0);
        }
        bytes32 computedHash = keccak256(
            abi.encodePacked(donationId, projectId, amount, paymentReference, blindingSalt)
        );
        bool isValid = (record.commitmentHash == computedHash);
        return (isValid, record.blockNumber);
    }

    function getDonationCommitmentCount() external view returns (uint256) {
        return donationCommitmentIds.length;
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
