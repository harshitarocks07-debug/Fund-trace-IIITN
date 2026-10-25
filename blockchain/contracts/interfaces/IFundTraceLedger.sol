// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFundTraceLedger {
    enum ExpenseStatus {
        PendingReview,
        Approved,
        Rejected,
        MoreEvidence
    }

    function registerProject(
        string calldata projectId,
        string calldata name,
        address ngoAddress,
        uint256 budget
    ) external;

    function anchorDonation(
        string calldata donationId,
        string calldata projectId,
        address donor,
        uint256 amount,
        string calldata earmarkTag,
        string calldata paymentReference
    ) external;

    function anchorExpenseAudit(
        string calldata expenseId,
        string calldata projectId,
        uint256 claimedAmount,
        bytes32 receiptHash,
        ExpenseStatus status,
        bytes32 decisionReasonHash
    ) external;

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
    );
}

