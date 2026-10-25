import { expect } from "chai";
import { ethers } from "hardhat";

describe("FundTraceEscrow", function () {
  const projectId = ethers.id("project-school");
  const secondProjectId = ethers.id("project-water");
  const claimId = ethers.id("claim-one");
  const duplicateClaimId = ethers.id("claim-two");
  const evidenceHash = ethers.sha256(ethers.toUtf8Bytes("private receipt bytes"));
  const secondEvidenceHash = ethers.sha256(ethers.toUtf8Bytes("another receipt"));

  let escrow: any;
  let validators: any[];
  let ngo: any;
  let secondNgo: any;
  let donor: any;
  let vendor: any;
  let relayer: any;

  async function typedSignatures(
    _primaryType: string,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, string | bigint | boolean>,
    signers = validators.slice(0, 3),
  ): Promise<string[]> {
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "FundTraceEscrow",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await escrow.getAddress(),
    };
    const orderedSigners = [...signers].sort((a, b) =>
      a.address.toLowerCase().localeCompare(b.address.toLowerCase()),
    );
    const signatures: string[] = [];

    for (const signer of orderedSigners) {
      signatures.push(
        await signer.signTypedData(domain, types, value),
      );
    }
    return signatures;
  }

  async function register(
    id = projectId,
    projectNgo = ngo,
  ): Promise<void> {
    const signatures = await typedSignatures("RegisterProject", {
      RegisterProject: [
        { name: "projectId", type: "bytes32" },
        { name: "ngo", type: "address" },
      ],
    }, { projectId: id, ngo: projectNgo.address });
    await escrow.connect(relayer).registerProject(id, projectNgo.address, signatures);
  }

  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    validators = accounts.slice(0, 5);
    [ngo, secondNgo, donor, vendor, relayer] = accounts.slice(5, 10);

    const FundTraceEscrow = await ethers.getContractFactory("FundTraceEscrow");
    escrow = await FundTraceEscrow.deploy(validators.map((validator) => validator.address));
    await escrow.waitForDeployment();
    await register();
    await register(secondProjectId, secondNgo);
  });

  it("requires five distinct non-zero validators at deployment", async function () {
    const FundTraceEscrow = await ethers.getContractFactory("FundTraceEscrow");
    const addresses = validators.map((validator) => validator.address);
    addresses[4] = addresses[0];
    await expect(FundTraceEscrow.deploy(addresses))
      .to.be.revertedWithCustomError(FundTraceEscrow, "InvalidValidators");
  });

  it("allows donors to fund projects and records NGO-submitted claims", async function () {
    await escrow.connect(donor).fundProject(projectId, { value: ethers.parseEther("1") });
    await expect(
      escrow.connect(ngo).submitClaim(
        projectId,
        claimId,
        evidenceHash,
        vendor.address,
        ethers.parseEther("0.4"),
      ),
    ).to.emit(escrow, "ClaimSubmitted");

    const project = await escrow.getProject(projectId);
    expect(project.balance).to.equal(ethers.parseEther("1"));
    expect(project.frozen).to.equal(false);
    expect((await escrow.claims(claimId)).exists).to.equal(true);
  });

  it("freezes both projects when exact evidence is submitted a second time", async function () {
    await escrow.connect(ngo).submitClaim(
      projectId,
      claimId,
      evidenceHash,
      vendor.address,
      ethers.parseEther("0.4"),
    );

    await expect(
      escrow.connect(secondNgo).submitClaim(
        secondProjectId,
        duplicateClaimId,
        evidenceHash,
        vendor.address,
        ethers.parseEther("0.4"),
      ),
    ).to.emit(escrow, "DuplicateEvidenceDetected");

    expect((await escrow.getProject(projectId)).frozen).to.equal(true);
    expect((await escrow.getProject(secondProjectId)).frozen).to.equal(true);
    expect(await escrow.disputedEvidence(evidenceHash)).to.equal(true);
    expect((await escrow.claims(duplicateClaimId)).exists).to.equal(false);
  });

  it("rejects disbursement without three valid validator signatures", async function () {
    await escrow.connect(donor).fundProject(projectId, { value: ethers.parseEther("1") });
    await escrow.connect(ngo).submitClaim(
      projectId,
      claimId,
      evidenceHash,
      vendor.address,
      ethers.parseEther("0.4"),
    );

    const types = {
      Disbursement: [
        { name: "projectId", type: "bytes32" },
        { name: "claimId", type: "bytes32" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    };
    const value = {
      projectId,
      claimId,
      evidenceHash,
      recipient: vendor.address,
      amount: ethers.parseEther("0.4"),
    };
    const signatures = await typedSignatures(
      "Disbursement",
      types,
      value,
      validators.slice(0, 2),
    );
    await expect(
      escrow.connect(relayer).disburse(projectId, claimId, signatures),
    ).to.be.revertedWithCustomError(escrow, "InvalidSignatures");
  });

  it("releases funds only after a quorum approves the exact claim", async function () {
    const amount = ethers.parseEther("0.4");
    await escrow.connect(donor).fundProject(projectId, { value: ethers.parseEther("1") });
    await escrow.connect(ngo).submitClaim(
      projectId,
      claimId,
      evidenceHash,
      vendor.address,
      amount,
    );
    const signatures = await typedSignatures("Disbursement", {
      Disbursement: [
        { name: "projectId", type: "bytes32" },
        { name: "claimId", type: "bytes32" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    }, {
      projectId,
      claimId,
      evidenceHash,
      recipient: vendor.address,
      amount,
    });

    await expect(
      escrow.connect(relayer).disburse(projectId, claimId, signatures),
    ).to.emit(escrow, "Disbursed").withArgs(projectId, claimId, vendor.address, amount);
    expect((await escrow.getProject(projectId)).balance).to.equal(ethers.parseEther("0.6"));
    expect((await escrow.claims(claimId)).disbursed).to.equal(true);
  });

  it("keeps a disputed receipt unpayable until quorum clears it", async function () {
    const amount = ethers.parseEther("0.4");
    await escrow.connect(donor).fundProject(projectId, { value: ethers.parseEther("1") });
    await escrow.connect(ngo).submitClaim(projectId, claimId, evidenceHash, vendor.address, amount);
    await escrow.connect(secondNgo).submitClaim(
      secondProjectId,
      duplicateClaimId,
      evidenceHash,
      vendor.address,
      amount,
    );

    const disbursementSignatures = await typedSignatures("Disbursement", {
      Disbursement: [
        { name: "projectId", type: "bytes32" },
        { name: "claimId", type: "bytes32" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    }, {
      projectId,
      claimId,
      evidenceHash,
      recipient: vendor.address,
      amount,
    });
    await expect(
      escrow.connect(relayer).disburse(projectId, claimId, disbursementSignatures),
    ).to.be.revertedWithCustomError(escrow, "ProjectFrozen");

    const freezeSignatures = await typedSignatures("ProjectFreeze", {
      ProjectFreeze: [
        { name: "projectId", type: "bytes32" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "frozen", type: "bool" },
        { name: "nonce", type: "uint256" },
      ],
    }, { projectId, evidenceHash, frozen: false, nonce: 0n });
    await escrow.connect(relayer).setProjectFreeze(
      projectId,
      evidenceHash,
      false,
      freezeSignatures,
    );

    const resolutionSignatures = await typedSignatures("EvidenceResolution", {
      EvidenceResolution: [
        { name: "evidenceHash", type: "bytes32" },
        { name: "clear", type: "bool" },
        { name: "nonce", type: "uint256" },
      ],
    }, { evidenceHash, clear: true, nonce: 0n });
    await escrow.connect(relayer).resolveDuplicateEvidence(
      evidenceHash,
      true,
      resolutionSignatures,
    );
    expect(await escrow.disputedEvidence(evidenceHash)).to.equal(false);
  });

  it("requires validator quorum to relay a duplicate from another chain", async function () {
    const network = await ethers.provider.getNetwork();
    const originChainId = network.chainId + 1n;
    const signatures = await typedSignatures("CrossChainDuplicate", {
      CrossChainDuplicate: [
        { name: "projectId", type: "bytes32" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "originChainId", type: "uint256" },
        { name: "originClaimId", type: "bytes32" },
        { name: "duplicateClaimId", type: "bytes32" },
        { name: "destinationChainId", type: "uint256" },
      ],
    }, {
      projectId: secondProjectId,
      evidenceHash: secondEvidenceHash,
      originChainId,
      originClaimId: claimId,
      duplicateClaimId,
      destinationChainId: network.chainId,
    });

    await expect(
      escrow.connect(relayer).reportCrossChainDuplicate(
        secondProjectId,
        secondEvidenceHash,
        originChainId,
        claimId,
        duplicateClaimId,
        signatures,
      ),
    ).to.emit(escrow, "CrossChainDuplicateReported");
    expect((await escrow.getProject(secondProjectId)).frozen).to.equal(true);
    expect(await escrow.disputedEvidence(secondEvidenceHash)).to.equal(true);
  });

  it("does not allow a project NGO or an outsider to bypass a freeze", async function () {
    const freezeSignatures = await typedSignatures("ProjectFreeze", {
      ProjectFreeze: [
        { name: "projectId", type: "bytes32" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "frozen", type: "bool" },
        { name: "nonce", type: "uint256" },
      ],
    }, { projectId, evidenceHash, frozen: true, nonce: 0n });
    await escrow.connect(relayer).setProjectFreeze(
      projectId,
      evidenceHash,
      true,
      freezeSignatures,
    );

    await expect(
      escrow.connect(ngo).submitClaim(
        projectId,
        ethers.id("claim-after-freeze"),
        secondEvidenceHash,
        vendor.address,
        ethers.parseEther("0.1"),
      ),
    ).to.be.revertedWith("Project frozen");

    await expect(
      escrow.connect(relayer).submitClaim(
        projectId,
        ethers.id("claim-unauthorized"),
        secondEvidenceHash,
        vendor.address,
        ethers.parseEther("0.1"),
      ),
    ).to.be.revertedWith("Caller is not project NGO");
  });
});
