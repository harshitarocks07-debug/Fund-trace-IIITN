// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FundTraceEscrow
 * @notice Native-token project escrow with duplicate-evidence freezes and
 * immutable 3-of-5 validator approvals. Project and claim identifiers are
 * opaque bytes32 values; no receipt contents are stored on-chain.
 */
contract FundTraceEscrow {
    uint256 public constant VALIDATOR_COUNT = 5;
    uint256 public constant QUORUM = 3;

    uint256 private constant SECP256K1N_HALF =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("FundTraceEscrow");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes32 private constant REGISTER_PROJECT_TYPEHASH =
        keccak256("RegisterProject(bytes32 projectId,address ngo)");
    bytes32 private constant DISBURSEMENT_TYPEHASH =
        keccak256("Disbursement(bytes32 projectId,bytes32 claimId,bytes32 evidenceHash,address recipient,uint256 amount)");
    bytes32 private constant PROJECT_FREEZE_TYPEHASH =
        keccak256("ProjectFreeze(bytes32 projectId,bytes32 evidenceHash,bool frozen,uint256 nonce)");
    bytes32 private constant CROSS_CHAIN_DUPLICATE_TYPEHASH =
        keccak256("CrossChainDuplicate(bytes32 projectId,bytes32 evidenceHash,uint256 originChainId,bytes32 originClaimId,bytes32 duplicateClaimId,uint256 destinationChainId)");
    bytes32 private constant EVIDENCE_RESOLUTION_TYPEHASH =
        keccak256("EvidenceResolution(bytes32 evidenceHash,bool clear,uint256 nonce)");

    struct Project {
        address ngo;
        uint256 balance;
        bool frozen;
        bool exists;
    }

    struct Claim {
        bytes32 projectId;
        bytes32 evidenceHash;
        address recipient;
        uint256 amount;
        bool exists;
        bool disbursed;
    }

    address[VALIDATOR_COUNT] public validators;
    mapping(bytes32 => Project) private projects;
    mapping(bytes32 => Claim) public claims;
    mapping(bytes32 => bytes32) public evidenceToClaim;
    mapping(bytes32 => bool) public disputedEvidence;
    mapping(bytes32 => bool) public processedCrossChainDuplicate;
    mapping(bytes32 => uint256) public projectFreezeNonce;
    uint256 public evidenceResolutionNonce;

    event ProjectRegistered(bytes32 indexed projectId, address indexed ngo);
    event ProjectFunded(bytes32 indexed projectId, address indexed donor, uint256 amount);
    event ClaimSubmitted(
        bytes32 indexed projectId,
        bytes32 indexed claimId,
        bytes32 indexed evidenceHash,
        address recipient,
        uint256 amount
    );
    event DuplicateEvidenceDetected(
        bytes32 indexed evidenceHash,
        bytes32 indexed originalClaimId,
        bytes32 indexed duplicateClaimId,
        bytes32 originalProjectId,
        bytes32 duplicateProjectId
    );
    event CrossChainDuplicateReported(
        bytes32 indexed evidenceHash,
        bytes32 indexed projectId,
        uint256 indexed originChainId,
        bytes32 originClaimId,
        bytes32 duplicateClaimId
    );
    event ProjectFreezeUpdated(bytes32 indexed projectId, bool frozen, bytes32 evidenceHash);
    event EvidenceResolutionUpdated(bytes32 indexed evidenceHash, bool disputed);
    event Disbursed(
        bytes32 indexed projectId,
        bytes32 indexed claimId,
        address indexed recipient,
        uint256 amount
    );

    error InvalidValidators();
    error InvalidSignatures();
    error UnknownProject();
    error ProjectFrozen();
    error DuplicateEvidence();
    error InvalidClaim();
    error InsufficientEscrow();
    error TransferFailed();

    constructor(address[VALIDATOR_COUNT] memory validatorSet) {
        for (uint256 i = 0; i < VALIDATOR_COUNT; i++) {
            address validator = validatorSet[i];
            if (validator == address(0)) revert InvalidValidators();
            for (uint256 j = 0; j < i; j++) {
                if (validatorSet[j] == validator) revert InvalidValidators();
            }
            validators[i] = validator;
        }
    }

    function registerProject(
        bytes32 projectId,
        address ngo,
        bytes[] calldata signatures
    ) external {
        require(projectId != bytes32(0) && ngo != address(0), "Invalid project");
        require(!projects[projectId].exists, "Project already exists");
        bytes32 structHash = keccak256(
            abi.encode(REGISTER_PROJECT_TYPEHASH, projectId, ngo)
        );
        _verifyQuorum(_hashTypedData(structHash), signatures);
        projects[projectId] = Project({
            ngo: ngo,
            balance: 0,
            frozen: false,
            exists: true
        });
        emit ProjectRegistered(projectId, ngo);
    }

    function fundProject(bytes32 projectId) external payable {
        Project storage project = projects[projectId];
        if (!project.exists) revert UnknownProject();
        require(msg.value > 0, "Amount must be positive");
        project.balance += msg.value;
        emit ProjectFunded(projectId, msg.sender, msg.value);
    }

    /**
     * @dev A duplicate returns normally so both affected project freezes persist.
     * The second claim is not stored or eligible for disbursement.
     */
    function submitClaim(
        bytes32 projectId,
        bytes32 claimId,
        bytes32 evidenceHash,
        address recipient,
        uint256 amount
    ) external returns (bool accepted) {
        Project storage project = projects[projectId];
        if (!project.exists) revert UnknownProject();
        require(msg.sender == project.ngo, "Caller is not project NGO");
        require(!project.frozen, "Project frozen");
        require(
            claimId != bytes32(0) &&
                evidenceHash != bytes32(0) &&
                recipient != address(0) &&
                amount > 0,
            "Invalid claim"
        );
        require(!claims[claimId].exists, "Claim already exists");

        bytes32 originalClaimId = evidenceToClaim[evidenceHash];
        if (originalClaimId != bytes32(0)) {
            Claim storage original = claims[originalClaimId];
            disputedEvidence[evidenceHash] = true;
            _freezeProject(original.projectId, evidenceHash);
            if (original.projectId != projectId) {
                _freezeProject(projectId, evidenceHash);
            }
            emit DuplicateEvidenceDetected(
                evidenceHash,
                originalClaimId,
                claimId,
                original.projectId,
                projectId
            );
            return false;
        }

        evidenceToClaim[evidenceHash] = claimId;
        claims[claimId] = Claim({
            projectId: projectId,
            evidenceHash: evidenceHash,
            recipient: recipient,
            amount: amount,
            exists: true,
            disbursed: false
        });
        emit ClaimSubmitted(projectId, claimId, evidenceHash, recipient, amount);
        return true;
    }

    function reportCrossChainDuplicate(
        bytes32 projectId,
        bytes32 evidenceHash,
        uint256 originChainId,
        bytes32 originClaimId,
        bytes32 duplicateClaimId,
        bytes[] calldata signatures
    ) external {
        Project storage project = projects[projectId];
        if (!project.exists) revert UnknownProject();
        require(originChainId != block.chainid, "Origin must be another chain");
        require(
            evidenceHash != bytes32(0) &&
                originClaimId != bytes32(0) &&
                duplicateClaimId != bytes32(0),
            "Invalid duplicate proof"
        );

        bytes32 structHash = keccak256(
            abi.encode(
                CROSS_CHAIN_DUPLICATE_TYPEHASH,
                projectId,
                evidenceHash,
                originChainId,
                originClaimId,
                duplicateClaimId,
                block.chainid
            )
        );
        bytes32 digest = _hashTypedData(structHash);
        require(!processedCrossChainDuplicate[digest], "Duplicate proof already used");
        _verifyQuorum(digest, signatures);

        processedCrossChainDuplicate[digest] = true;
        disputedEvidence[evidenceHash] = true;
        _freezeProject(projectId, evidenceHash);
        emit CrossChainDuplicateReported(
            evidenceHash,
            projectId,
            originChainId,
            originClaimId,
            duplicateClaimId
        );
    }

    function setProjectFreeze(
        bytes32 projectId,
        bytes32 evidenceHash,
        bool frozen,
        bytes[] calldata signatures
    ) external {
        Project storage project = projects[projectId];
        if (!project.exists) revert UnknownProject();
        uint256 nonce = projectFreezeNonce[projectId]++;
        bytes32 structHash = keccak256(
            abi.encode(
                PROJECT_FREEZE_TYPEHASH,
                projectId,
                evidenceHash,
                frozen,
                nonce
            )
        );
        _verifyQuorum(_hashTypedData(structHash), signatures);
        project.frozen = frozen;
        emit ProjectFreezeUpdated(projectId, frozen, evidenceHash);
    }

    function resolveDuplicateEvidence(
        bytes32 evidenceHash,
        bool clear,
        bytes[] calldata signatures
    ) external {
        require(evidenceHash != bytes32(0), "Invalid evidence hash");
        uint256 nonce = evidenceResolutionNonce++;
        bytes32 structHash = keccak256(
            abi.encode(
                EVIDENCE_RESOLUTION_TYPEHASH,
                evidenceHash,
                clear,
                nonce
            )
        );
        _verifyQuorum(_hashTypedData(structHash), signatures);
        disputedEvidence[evidenceHash] = !clear;
        emit EvidenceResolutionUpdated(evidenceHash, !clear);
    }

    function disburse(
        bytes32 projectId,
        bytes32 claimId,
        bytes[] calldata signatures
    ) external {
        Project storage project = projects[projectId];
        if (!project.exists) revert UnknownProject();
        if (project.frozen) revert ProjectFrozen();

        Claim storage claim = claims[claimId];
        if (
            !claim.exists ||
            claim.projectId != projectId ||
            claim.disbursed ||
            disputedEvidence[claim.evidenceHash]
        ) revert InvalidClaim();
        if (project.balance < claim.amount) revert InsufficientEscrow();

        bytes32 structHash = keccak256(
            abi.encode(
                DISBURSEMENT_TYPEHASH,
                projectId,
                claimId,
                claim.evidenceHash,
                claim.recipient,
                claim.amount
            )
        );
        _verifyQuorum(_hashTypedData(structHash), signatures);

        claim.disbursed = true;
        project.balance -= claim.amount;
        (bool success, ) = payable(claim.recipient).call{value: claim.amount}("");
        if (!success) revert TransferFailed();
        emit Disbursed(projectId, claimId, claim.recipient, claim.amount);
    }

    function getProject(bytes32 projectId)
        external
        view
        returns (address ngo, uint256 balance, bool frozen, bool exists)
    {
        Project memory project = projects[projectId];
        return (project.ngo, project.balance, project.frozen, project.exists);
    }

    function _freezeProject(bytes32 projectId, bytes32 evidenceHash) private {
        Project storage project = projects[projectId];
        if (!project.frozen) {
            project.frozen = true;
            emit ProjectFreezeUpdated(projectId, true, evidenceHash);
        }
    }

    function _verifyQuorum(
        bytes32 digest,
        bytes[] calldata signatures
    ) private view {
        if (signatures.length < QUORUM || signatures.length > VALIDATOR_COUNT) {
            revert InvalidSignatures();
        }

        address previousSigner = address(0);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = _recover(digest, signatures[i]);
            if (signer <= previousSigner || !_isValidator(signer)) {
                revert InvalidSignatures();
            }
            previousSigner = signer;
        }
    }

    function _recover(bytes32 digest, bytes calldata signature)
        private
        pure
        returns (address signer)
    {
        if (signature.length != 65) revert InvalidSignatures();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > SECP256K1N_HALF) revert InvalidSignatures();
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignatures();
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignatures();
    }

    function _isValidator(address account) private view returns (bool) {
        for (uint256 i = 0; i < VALIDATOR_COUNT; i++) {
            if (validators[i] == account) return true;
        }
        return false;
    }

    function _hashTypedData(bytes32 structHash) private view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                NAME_HASH,
                VERSION_HASH,
                block.chainid,
                address(this)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
}
