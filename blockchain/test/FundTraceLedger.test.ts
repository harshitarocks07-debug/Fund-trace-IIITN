import { expect } from "chai";
import { ethers } from "hardhat";

describe("FundTraceLedger", function () {
  let ledger: any;
  let owner: any;
  let auditor: any;
  let ngo: any;
  let donor: any;
  let vendor: any;
  let unauthorized: any;

  // Sample bytes32 SHA-256 fingerprint of a private receipt.
  const sampleReceiptHash =
    "0xa81f4d2c9b7e6a1083d5f7c1e9a2b4d6f8c0e1a3b5d7f9c2e4a6b8d0f2a4c6e8";
  const sampleReasonHash = ethers.keccak256(
    ethers.toUtf8Bytes("Approved: vendor invoice verified.")
  );

  beforeEach(async function () {
    [owner, auditor, ngo, donor, vendor, unauthorized] =
      await ethers.getSigners();

    const FundTraceLedger = await ethers.getContractFactory("FundTraceLedger");
    ledger = await FundTraceLedger.deploy();
    await ledger.waitForDeployment();

    // Authorize auditor & NGO.
    await ledger.setAuditor(auditor.address, true);
    await ledger.setNgo(ngo.address, true);
  });

  async function createExpense(
    expenseId = "EXP-PAY-001",
    projectId = "PRJ-PAY-001",
    receiptHash = sampleReceiptHash
  ) {
    await ledger
      .connect(ngo)
      .registerProject(projectId, "Payment Linkage Test Project", ngo.address, 1000000);

    await ledger.connect(auditor).anchorExpenseAudit(
      expenseId,
      projectId,
      200000,
      receiptHash,
      0, // PendingReview
      sampleReasonHash
    );
  }

  it("should register a project with budget and NGO address", async function () {
    await ledger
      .connect(ngo)
      .registerProject("PRJ-001", "School Construction", ngo.address, 1000000);

    const summary = await ledger.getProjectSummary("PRJ-001");
    expect(summary[0]).to.equal("School Construction");
    expect(summary[1]).to.equal(1000000);
    expect(summary[4]).to.equal(true);
  });

  it("should anchor an earmarked donation", async function () {
    await ledger
      .connect(ngo)
      .registerProject("PRJ-001", "School Construction", ngo.address, 1000000);

    await expect(
      ledger.connect(ngo).anchorDonation(
        "DON-1042",
        "PRJ-001",
        donor.address,
        500000,
        "Water infrastructure",
        "PAY-8K2F19"
      )
    ).to.emit(ledger, "DonationAnchored");

    const summary = await ledger.getProjectSummary("PRJ-001");
    expect(summary[2]).to.equal(500000);
  });

  it("should anchor auditor review decision with cryptographic receipt hash", async function () {
    await ledger
      .connect(ngo)
      .registerProject("PRJ-001", "School Construction", ngo.address, 1000000);

    await expect(
      ledger.connect(auditor).anchorExpenseAudit(
        "EXP-001",
        "PRJ-001",
        200000,
        sampleReceiptHash,
        1, // Approved
        sampleReasonHash
      )
    )
      .to.emit(ledger, "ExpenseAudited")
      .to.emit(ledger, "ImpactProofVerified");

    const verification = await ledger.verifyReceiptCommitment(
      "EXP-001",
      sampleReceiptHash
    );
    expect(verification.matches).to.equal(true);
    expect(verification.status).to.equal(1);
    expect(verification.auditor).to.equal(auditor.address);
    expect(verification.claimedAmount).to.equal(200000);
  });

  it("should prevent duplicate receipt reuse across expenses on-chain", async function () {
    await ledger
      .connect(ngo)
      .registerProject("PRJ-001", "School Construction", ngo.address, 1000000);
    await ledger
      .connect(ngo)
      .registerProject("PRJ-002", "Clean Water Project", ngo.address, 500000);

    await ledger.connect(auditor).anchorExpenseAudit(
      "EXP-001",
      "PRJ-001",
      200000,
      sampleReceiptHash,
      1,
      sampleReasonHash
    );

    await expect(
      ledger.connect(auditor).anchorExpenseAudit(
        "EXP-002",
        "PRJ-002",
        150000,
        sampleReceiptHash,
        1,
        sampleReasonHash
      )
    ).to.be.revertedWith(
      "Duplicate evidence: Receipt hash already anchored to another claim"
    );
  });

  it("should reject unauthorized callers trying to anchor audit decisions", async function () {
    await ledger
      .connect(ngo)
      .registerProject("PRJ-001", "School Construction", ngo.address, 1000000);

    await expect(
      ledger.connect(donor).anchorExpenseAudit(
        "EXP-001",
        "PRJ-001",
        200000,
        sampleReceiptHash,
        1,
        sampleReasonHash
      )
    ).to.be.revertedWith("FundTrace: Caller is not authorized auditor");
  });

  describe("Payment-to-Invoice Linkage", function () {
    const paymentTxHash = ethers.keccak256(
      ethers.toUtf8Bytes("sample-sepolia-payment-transaction")
    );

    it("should link a payment transaction to an existing expense and invoice", async function () {
      await createExpense();

      await expect(
        ledger.connect(ngo).linkPaymentToInvoice(
          "EXP-PAY-001",
          paymentTxHash,
          sampleReceiptHash,
          ngo.address,
          vendor.address,
          1000000000000000n
        )
      ).to.emit(ledger, "PaymentInvoiceLinked");

      const result = await ledger.verifyPaymentInvoiceLink(
        "EXP-PAY-001",
        paymentTxHash,
        sampleReceiptHash
      );

      expect(result.matches).to.equal(true);
      expect(result.ngoAddress).to.equal(ngo.address);
      expect(result.vendorAddress).to.equal(vendor.address);
      expect(result.amountWei).to.equal(1000000000000000n);
    });

    it("should reject linking a payment to the same expense twice", async function () {
      await createExpense();

      await ledger.connect(ngo).linkPaymentToInvoice(
        "EXP-PAY-001",
        paymentTxHash,
        sampleReceiptHash,
        ngo.address,
        vendor.address,
        1000000000000000n
      );

      await expect(
        ledger.connect(ngo).linkPaymentToInvoice(
          "EXP-PAY-001",
          paymentTxHash,
          sampleReceiptHash,
          ngo.address,
          vendor.address,
          1000000000000000n
        )
      ).to.be.revertedWith("Payment already linked to expense");
    });

    it("should reject reusing one transaction for another expense", async function () {
      await createExpense("EXP-PAY-001", "PRJ-PAY-001", sampleReceiptHash);

      const secondReceiptHash = ethers.sha256(
        ethers.toUtf8Bytes("second-invoice-content")
      );
      await createExpense(
        "EXP-PAY-002",
        "PRJ-PAY-002",
        secondReceiptHash
      );

      await ledger.connect(ngo).linkPaymentToInvoice(
        "EXP-PAY-001",
        paymentTxHash,
        sampleReceiptHash,
        ngo.address,
        vendor.address,
        1000000000000000n
      );

      await expect(
        ledger.connect(ngo).linkPaymentToInvoice(
          "EXP-PAY-002",
          paymentTxHash,
          secondReceiptHash,
          ngo.address,
          vendor.address,
          1000000000000000n
        )
      ).to.be.revertedWith(
        "Transaction already linked to another expense"
      );
    });

    it("should reject an unauthorized caller", async function () {
      await createExpense();

      await expect(
        ledger.connect(unauthorized).linkPaymentToInvoice(
          "EXP-PAY-001",
          paymentTxHash,
          sampleReceiptHash,
          unauthorized.address,
          vendor.address,
          1000000000000000n
        )
      ).to.be.revertedWith(
        "FundTrace: Caller is not authorized NGO or owner"
      );
    });

    it("should return false when the invoice hash does not match", async function () {
      await createExpense();

      await ledger.connect(ngo).linkPaymentToInvoice(
        "EXP-PAY-001",
        paymentTxHash,
        sampleReceiptHash,
        ngo.address,
        vendor.address,
        1000000000000000n
      );

      const incorrectInvoiceHash = ethers.sha256(
        ethers.toUtf8Bytes("different-invoice-content")
      );

      const result = await ledger.verifyPaymentInvoiceLink(
        "EXP-PAY-001",
        paymentTxHash,
        incorrectInvoiceHash
      );

      expect(result.matches).to.equal(false);
    });

    it("should return false for a transaction hash that does not match", async function () {
      await createExpense();

      await ledger.connect(ngo).linkPaymentToInvoice(
        "EXP-PAY-001",
        paymentTxHash,
        sampleReceiptHash,
        ngo.address,
        vendor.address,
        1000000000000000n
      );

      const incorrectTxHash = ethers.keccak256(
        ethers.toUtf8Bytes("different-payment-transaction")
      );

      const result = await ledger.verifyPaymentInvoiceLink(
        "EXP-PAY-001",
        incorrectTxHash,
        sampleReceiptHash
      );

      expect(result.matches).to.equal(false);
    });
  });
});
