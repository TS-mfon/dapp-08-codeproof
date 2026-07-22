// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    ICodeProofCertificate,
    IRitualWallet,
    ITEEServiceRegistry,
    RitualAddresses
} from "./RitualInterfaces.sol";

contract CodeProofReviewRegistry {
    enum ReviewMode {
        FAST,
        DEEP
    }

    enum ReviewStatus {
        CREATED,
        SOURCE_FETCHED,
        AI_REQUESTED,
        COMPLETED,
        FAILED,
        EXPIRED,
        CANCELLED
    }

    struct Provenance {
        bytes publicKey;
        bytes signature;
    }

    struct LLMConfig {
        address executor;
        uint64 ttl;
    }

    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    struct IssueSummary {
        uint16 critical;
        uint16 high;
        uint16 medium;
        uint16 low;
        uint16 gas;
    }

    struct Review {
        address owner;
        ReviewMode mode;
        ReviewStatus status;
        uint64 createdBlock;
        uint64 updatedBlock;
        uint64 pendingUntilBlock;
        uint32 versionCount;
        bool publicShare;
        bool provenanceVerified;
        bytes32 provenanceKeyHash;
        bytes32 latestHash;
        string latestURI;
    }

    struct ReviewVersion {
        ReviewMode mode;
        ReviewStatus status;
        uint16 score;
        bool certificateMinted;
        bytes32 sourceHash;
        string sourceURI;
        bytes32 instructionHash;
        string instructionURI;
        bytes32 reportHash;
        string reportURI;
        bytes32 jobId;
        uint256 scheduleId;
        IssueSummary issues;
    }

    address public owner;
    address public pendingOwner;
    address public treasury;
    address public certificateContract;
    bool public paused;
    uint256 private _entered;

    uint256 public nextReviewId;
    uint256 public fastReviewFee = 0.01 ether;
    uint256 public deepReviewFee = 0.03 ether;
    uint16 public passingScoreThreshold = 70;

    mapping(uint256 => Review) public reviews;
    mapping(uint256 => mapping(uint32 => ReviewVersion)) private _versions;
    mapping(uint256 => mapping(uint32 => string)) private _reports;
    mapping(address => uint256[]) private _ownerRecords;

    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ReviewRequested(
        uint256 indexed id,
        uint32 indexed version,
        address indexed owner,
        ReviewMode mode,
        bytes32 sourceHash,
        string sourceURI,
        bool provenanceVerified
    );
    event ReviewStatusUpdated(
        uint256 indexed id,
        uint32 indexed version,
        ReviewStatus status,
        string reason
    );
    event ReviewCommitted(
        uint256 indexed id,
        uint32 indexed version,
        uint16 score,
        bytes32 reportHash,
        string reportURI,
        IssueSummary issues
    );
    event ReviewVisibilityUpdated(uint256 indexed id, bool publicShare);
    event CertificateMinted(
        uint256 indexed reviewId,
        uint32 indexed version,
        uint256 indexed tokenId
    );
    event FeesUpdated(uint256 fastFee, uint256 deepFee);
    event TreasuryUpdated(address indexed treasury);
    event CertificateContractUpdated(address indexed certificate);
    event PassingScoreThresholdUpdated(uint16 threshold);
    event Paused(bool paused);

    error Unauthorized();
    error InvalidInput();
    error InvalidState();
    error InvalidExecutor();
    error InsufficientFee();
    error PrecompileFailed();
    error SourceTooLarge();
    error SoulboundNotEligible();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert InvalidState();
        _;
    }

    modifier nonReentrant() {
        if (_entered == 1) revert InvalidState();
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor(address treasury_) {
        if (treasury_ == address(0)) revert InvalidInput();
        owner = msg.sender;
        treasury = treasury_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    receive() external payable {}

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidInput();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previous = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, msg.sender);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function setFees(uint256 fastFee, uint256 deepFee) external onlyOwner {
        fastReviewFee = fastFee;
        deepReviewFee = deepFee;
        emit FeesUpdated(fastFee, deepFee);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert InvalidInput();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setCertificateContract(address certificate_) external onlyOwner {
        if (certificate_ == address(0)) revert InvalidInput();
        certificateContract = certificate_;
        emit CertificateContractUpdated(certificate_);
    }

    function setPassingScoreThreshold(uint16 threshold) external onlyOwner {
        if (threshold > 100) revert InvalidInput();
        passingScoreThreshold = threshold;
        emit PassingScoreThresholdUpdated(threshold);
    }

    function requestReview(
        string calldata source,
        string calldata language,
        Provenance calldata proof,
        LLMConfig calldata config
    ) external payable whenNotPaused nonReentrant returns (uint256 reviewId) {
        bytes memory sourceBytes = bytes(source);
        if (sourceBytes.length == 0) revert InvalidInput();
        if (sourceBytes.length > 12_000) revert SourceTooLarge();
        _validateExecutor(config.executor);
        if (config.ttl == 0 || config.ttl > 500) revert InvalidInput();

        bytes32 sourceHash = keccak256(sourceBytes);
        (bool verified, bytes32 keyHash) =
            _verifyProvenance(sourceHash, language, proof, msg.sender);
        reviewId = nextReviewId++;

        Review storage review = reviews[reviewId];
        review.owner = msg.sender;
        review.mode = ReviewMode.FAST;
        review.status = ReviewStatus.AI_REQUESTED;
        review.createdBlock = uint64(block.number);
        review.updatedBlock = uint64(block.number);
        review.pendingUntilBlock = uint64(block.number + config.ttl);
        review.versionCount = 1;
        review.provenanceVerified = verified;
        review.provenanceKeyHash = keyHash;

        string memory sourceURI = string.concat("inline://", language);
        ReviewVersion storage item = _versions[reviewId][1];
        item.mode = ReviewMode.FAST;
        item.status = ReviewStatus.AI_REQUESTED;
        item.sourceHash = sourceHash;
        item.sourceURI = sourceURI;
        _ownerRecords[msg.sender].push(reviewId);

        emit ReviewRequested(
            reviewId,
            1,
            msg.sender,
            ReviewMode.FAST,
            sourceHash,
            sourceURI,
            verified
        );
        emit ReviewStatusUpdated(
            reviewId,
            1,
            ReviewStatus.AI_REQUESTED,
            "ritual llm requested"
        );

        _collectFee(config.ttl);
        bytes memory input = _llmInput(config, language, source);
        (bool ok, bytes memory raw) = RitualAddresses.LLM.call(input);
        if (!ok) revert PrecompileFailed();
        (, bytes memory actual) = abi.decode(raw, (bytes, bytes));
        if (actual.length == 0) return reviewId;

        (
            bool hasError,
            bytes memory completionData,
            ,
            string memory errorMessage,

        ) = abi.decode(actual, (bool, bytes, bytes, string, StorageRef));
        if (hasError) {
            _fail(reviewId, errorMessage);
            return reviewId;
        }

        _commitStructured(reviewId, _completionText(completionData));
    }

    function parseReviewJson(string calldata json)
        external
        view
        returns (uint16 score, IssueSummary memory issues)
    {
        if (msg.sender != address(this)) revert Unauthorized();
        uint256 rawScore = _jqUint(".score", json);
        if (rawScore > 100) revert InvalidInput();
        score = uint16(rawScore);
        issues = IssueSummary({
            critical: _toUint16(_jqUint(".issues.critical", json)),
            high: _toUint16(_jqUint(".issues.high", json)),
            medium: _toUint16(_jqUint(".issues.medium", json)),
            low: _toUint16(_jqUint(".issues.low", json)),
            gas: _toUint16(_jqUint(".issues.gas", json))
        });
    }

    function setPublicShare(uint256 reviewId, bool enabled) external {
        Review storage review = reviews[reviewId];
        if (review.owner != msg.sender) revert Unauthorized();
        review.publicShare = enabled;
        review.updatedBlock = uint64(block.number);
        emit ReviewVisibilityUpdated(reviewId, enabled);
    }

    function mintCertificate(uint256 reviewId, uint32 version)
        external
        nonReentrant
        returns (uint256 tokenId)
    {
        Review storage review = reviews[reviewId];
        ReviewVersion storage item = _versions[reviewId][version];
        if (review.owner != msg.sender) revert Unauthorized();
        if (
            item.status != ReviewStatus.COMPLETED || item.certificateMinted
                || item.score < passingScoreThreshold || item.issues.critical != 0
                || certificateContract == address(0)
        ) revert SoulboundNotEligible();

        item.certificateMinted = true;
        tokenId = ICodeProofCertificate(certificateContract).mint(
            msg.sender,
            reviewId,
            version,
            item.reportHash,
            item.reportURI
        );
        emit CertificateMinted(reviewId, version, tokenId);
    }

    function getReview(uint256 reviewId) external view returns (Review memory) {
        return reviews[reviewId];
    }

    function getVersion(uint256 reviewId, uint32 version)
        external
        view
        returns (ReviewVersion memory)
    {
        return _versions[reviewId][version];
    }

    function getReport(uint256 reviewId, uint32 version)
        external
        view
        returns (string memory)
    {
        Review storage review = reviews[reviewId];
        if (!review.publicShare && msg.sender != review.owner) revert Unauthorized();
        return _reports[reviewId][version];
    }

    function getOwnerRecords(address account, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory result)
    {
        uint256[] storage records = _ownerRecords[account];
        if (offset >= records.length || limit == 0) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > records.length) end = records.length;
        result = new uint256[](end - offset);
        for (uint256 i; i < result.length; ++i) result[i] = records[offset + i];
    }

    function ownerRecordCount(address account) external view returns (uint256) {
        return _ownerRecords[account].length;
    }

    function _llmInput(
        LLMConfig calldata config,
        string calldata language,
        string calldata source
    ) internal pure returns (bytes memory) {
        string memory messagesJson = string.concat(
            '[{"role":"system","content":"You are CodeProof, a strict application security reviewer. Return only JSON matching the requested schema. Give concrete findings and remediation."},',
            '{"role":"user","content":"Audit this ',
            _jsonEscape(language),
            ' source code for security, correctness, authentication, authorization, injection, dependency, performance, testing, and deployment risks. Source:\\n',
            _jsonEscape(source),
            '"}]'
        );
        return abi.encode(
            config.executor,
            new bytes[](0),
            uint256(config.ttl),
            new bytes[](0),
            bytes(""),
            messagesJson,
            "zai-org/GLM-4.7-FP8",
            int256(0),
            "",
            false,
            int256(4096),
            "",
            "",
            uint256(1),
            true,
            int256(0),
            "medium",
            _reviewResponseFormat(),
            int256(-1),
            "auto",
            "",
            false,
            int256(200),
            bytes(""),
            bytes(""),
            int256(-1),
            int256(1000),
            "",
            false,
            StorageRef("", "", "")
        );
    }

    function _collectFee(uint64 ttl) internal {
        if (msg.value < fastReviewFee) revert InsufficientFee();
        (bool sent,) = treasury.call{value: fastReviewFee}("");
        if (!sent) revert PrecompileFailed();
        uint256 executionBudget = msg.value - fastReviewFee;
        if (executionBudget != 0) {
            IRitualWallet(RitualAddresses.RITUAL_WALLET).deposit{
                value: executionBudget
            }(uint256(ttl) + 5_000);
        }
    }

    function _verifyProvenance(
        bytes32 sourceHash,
        string calldata language,
        Provenance calldata proof,
        address submitter
    ) internal view returns (bool verified, bytes32 keyHash) {
        if (proof.publicKey.length == 0 && proof.signature.length == 0) {
            return (false, bytes32(0));
        }
        if (proof.publicKey.length != 32 || proof.signature.length != 64) {
            revert InvalidInput();
        }
        bytes memory message = abi.encodePacked(
            "CODEPROOF_SOURCE_V1",
            block.chainid,
            address(this),
            submitter,
            sourceHash,
            keccak256(bytes(language))
        );
        (bool ok, bytes memory raw) = RitualAddresses.ED25519.staticcall(
            abi.encode(proof.publicKey, message, proof.signature)
        );
        if (!ok || raw.length == 0 || abi.decode(raw, (uint256)) != 1) {
            revert InvalidInput();
        }
        return (true, keccak256(proof.publicKey));
    }

    function _validateExecutor(address executor) internal view {
        if (executor == address(0)) revert InvalidExecutor();
        ITEEServiceRegistry.TEEServiceContext memory context =
            ITEEServiceRegistry(RitualAddresses.TEE_SERVICE_REGISTRY).getService(
                executor,
                true
            );
        if (
            !context.isValid || context.node.teeAddress != executor
                || context.node.capability != 1
        ) revert InvalidExecutor();
    }

    function _commitStructured(uint256 reviewId, string memory json) internal {
        try this.parseReviewJson(json) returns (
            uint16 score,
            IssueSummary memory issues
        ) {
            Review storage review = reviews[reviewId];
            ReviewVersion storage item = _versions[reviewId][1];
            bytes32 reportHash = keccak256(bytes(json));
            string memory reportURI =
                string.concat("onchain://codeproof/", _toString(reviewId), "/1");
            item.score = score;
            item.issues = issues;
            item.reportHash = reportHash;
            item.reportURI = reportURI;
            item.status = ReviewStatus.COMPLETED;
            review.status = ReviewStatus.COMPLETED;
            review.updatedBlock = uint64(block.number);
            review.latestHash = reportHash;
            review.latestURI = reportURI;
            _reports[reviewId][1] = json;
            emit ReviewCommitted(
                reviewId,
                1,
                score,
                reportHash,
                reportURI,
                issues
            );
        } catch {
            _fail(reviewId, "structured output validation failed");
        }
    }

    function _fail(uint256 reviewId, string memory reason) internal {
        reviews[reviewId].status = ReviewStatus.FAILED;
        reviews[reviewId].updatedBlock = uint64(block.number);
        _versions[reviewId][1].status = ReviewStatus.FAILED;
        emit ReviewStatusUpdated(reviewId, 1, ReviewStatus.FAILED, reason);
    }

    function _completionText(bytes memory completionData)
        internal
        pure
        returns (string memory)
    {
        (, , , , , , uint256 choicesCount, bytes[] memory choicesData,) =
            abi.decode(
                completionData,
                (string, string, uint256, string, string, string, uint256, bytes[], bytes)
            );
        if (choicesCount == 0 || choicesData.length == 0) revert InvalidInput();
        (, , bytes memory messageData) =
            abi.decode(choicesData[0], (uint256, string, bytes));
        (, string memory content,,,) =
            abi.decode(messageData, (string, string, string, uint256, bytes[]));
        if (bytes(content).length == 0) revert InvalidInput();
        return content;
    }

    function _jqUint(string memory query, string memory json)
        internal
        view
        returns (uint256)
    {
        (bool ok, bytes memory raw) =
            RitualAddresses.JQ.staticcall(abi.encode(query, json, uint8(1)));
        if (!ok || raw.length == 0) revert InvalidInput();
        return abi.decode(raw, (uint256));
    }

    function _toUint16(uint256 value) internal pure returns (uint16) {
        if (value > type(uint16).max) revert InvalidInput();
        return uint16(value);
    }

    function _reviewResponseFormat() internal pure returns (bytes memory) {
        string memory schema =
            '{"type":"object","properties":{"score":{"type":"integer","minimum":0,"maximum":100},"issues":{"type":"object","properties":{"critical":{"type":"integer"},"high":{"type":"integer"},"medium":{"type":"integer"},"low":{"type":"integer"},"gas":{"type":"integer"}},"required":["critical","high","medium","low","gas"]},"summary":{"type":"string"},"risks":{"type":"array","items":{"type":"string"}}},"required":["score","issues","summary","risks"]}';
        return abi.encode(
            "json_schema",
            abi.encode("codeproof_review", "CodeProof structured review", schema, "true")
        );
    }

    function _jsonEscape(string memory value) internal pure returns (string memory) {
        bytes memory input = bytes(value);
        bytes memory output = new bytes(input.length * 2);
        uint256 length;
        for (uint256 i; i < input.length; ++i) {
            bytes1 char = input[i];
            if (char == '"' || char == "\\") {
                output[length++] = "\\";
                output[length++] = char;
            } else if (char == "\n") {
                output[length++] = "\\";
                output[length++] = "n";
            } else if (char == "\r") {
                output[length++] = "\\";
                output[length++] = "r";
            } else if (char == "\t") {
                output[length++] = "\\";
                output[length++] = "t";
            } else {
                output[length++] = char;
            }
        }
        assembly ("memory-safe") {
            mstore(output, length)
        }
        return string(output);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 digits;
        uint256 cursor = value;
        while (cursor != 0) {
            digits++;
            cursor /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            buffer[--digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
