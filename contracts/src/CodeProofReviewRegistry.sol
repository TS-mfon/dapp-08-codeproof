// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRitualWallet {
    function depositFor(address user, uint256 lockDuration) external payable;
}

interface ICodeProofCertificate {
    function mint(address to, string calldata reportURI) external returns (uint256);
}

contract CodeProofReviewRegistry is Ownable, ReentrancyGuard {
    address public constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    address public constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;
    address public constant SOVEREIGN_AGENT_PRECOMPILE = 0x000000000000000000000000000000000000080C;

    struct IssueSummary {
        uint16 critical;
        uint16 high;
        uint16 medium;
        uint16 low;
        uint16 gas;
    }

    struct Review {
        address developer;
        uint16 score;
        bool certificateMinted;
        bytes32 codeHash;
        bytes32 reportHash;
        string reportURI;
        IssueSummary issues;
    }

    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    mapping(uint256 => Review) public reviews;
    mapping(address => uint256[]) public developerReviews;
    mapping(bytes32 => uint256) public jobToReview;

    uint256 public nextId;
    uint256 public requestFee;
    uint16 public passingScoreThreshold = 70;
    address public certificateContract;

    event ReviewRequested(uint256 indexed id, address indexed owner, bytes32 indexed codeHash, bytes32 jobId);
    event ReviewCommitted(uint256 indexed id, uint16 score, bytes32 reportHash, string reportURI);
    event CertificateMinted(uint256 indexed reviewId, uint256 indexed tokenId, address indexed developer);
    event RequestFeeUpdated(uint256 newFee);
    event PassingScoreThresholdUpdated(uint16 newThreshold);
    event CertificateContractUpdated(address newContract);

    modifier onlyAsyncDelivery() {
        require(msg.sender == ASYNC_DELIVERY, "Only async delivery allowed");
        _;
    }

    constructor() Ownable(msg.sender) {
        requestFee = 0.01 ether; // 0.01 RITUAL
    }

    function setCertificateContract(address _certContract) external onlyOwner {
        require(_certContract != address(0), "Invalid certificate contract address");
        certificateContract = _certContract;
        emit CertificateContractUpdated(_certContract);
    }

    function setRequestFee(uint256 _fee) external onlyOwner {
        requestFee = _fee;
        emit RequestFeeUpdated(_fee);
    }

    function setPassingScoreThreshold(uint16 _threshold) external onlyOwner {
        passingScoreThreshold = _threshold;
        emit PassingScoreThresholdUpdated(_threshold);
    }

    function requestCodeReview(
        bytes32 codeHash,
        string calldata sourceURI,
        address executor,
        uint64 ttl
    ) external payable nonReentrant returns (uint256 reviewId) {
        require(msg.value >= requestFee, "Insufficient request fee");
        require(executor != address(0), "Executor cannot be zero address");
        require(ttl > 0, "TTL must be greater than zero");

        reviewId = nextId++;

        // Fund user's RitualWallet balance if extra funds were sent
        uint256 feeToDeposit = msg.value - requestFee;
        if (feeToDeposit > 0) {
            IRitualWallet(RITUAL_WALLET).depositFor{value: feeToDeposit}(msg.sender, ttl);
        }

        // Setup the Sovereign Agent precompile prompt and config
        string memory prompt = string(abi.encodePacked(
            "Conduct a detailed smart contract review of the Solidity file at: ", sourceURI,
            ". Verify the content hash matches: ", vmToString(codeHash),
            ". Return a JSON containing exact counts for issue categories (critical, high, medium, low, gas), a score from 0-100, and a report hash."
        ));

        // Sovereign Agent has 23 fields
        bytes memory precompileInput = abi.encode(
            executor,                             // 0: TEE executor
            uint256(ttl),                         // 1: TTL
            hex"",                                // 2: userPublicKey (unencrypted)
            uint64(5),                            // 3: pollIntervalBlocks
            uint64(1000),                         // 4: maxPollBlock
            "{{TASK_ID}}",                        // 5: taskIdMarker
            address(this),                        // 6: deliveryTarget
            this.onSovereignAgentResult.selector, // 7: deliverySelector
            uint256(1_500_000),                   // 8: deliveryGasLimit
            uint256(1_000_000_000),               // 9: deliveryMaxFeePerGas
            uint256(100_000_000),                 // 10: deliveryMaxPriorityFeePerGas
            uint16(0),                            // 11: cliType (0 = claude_code)
            prompt,                               // 12: prompt
            hex"",                                // 13: encryptedSecrets
            StorageRef("", "", ""),               // 14: convoHistory
            StorageRef("", "", ""),               // 15: output
            new StorageRef[](0),                  // 16: skills
            StorageRef("", "", ""),               // 17: systemPrompt
            "zai-org/GLM-4.7-FP8",                // 18: model
            new string[](0),                      // 19: tools
            uint16(10),                           // 20: maxTurns
            uint32(4096),                         // 21: maxTokens
            ""                                    // 22: rpcUrls
        );

        // Call the Sovereign Agent precompile
        (bool success, bytes memory rawOutput) = SOVEREIGN_AGENT_PRECOMPILE.call(precompileInput);
        require(success, "Sovereign Agent precompile call failed");

        // Decode Phase 1 output (bytes32 job commitment hash)
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        bytes32 jobId = abi.decode(actualOutput, (bytes32));

        // Track job relationship
        jobToReview[jobId] = reviewId;
        reviews[reviewId].developer = msg.sender;
        reviews[reviewId].codeHash = codeHash;
        developerReviews[msg.sender].push(reviewId);

        emit ReviewRequested(reviewId, msg.sender, codeHash, jobId);
    }

    /// @notice Callback function invoked by AsyncDelivery on completion.
    function onSovereignAgentResult(bytes32 jobId, bytes calldata result) external onlyAsyncDelivery nonReentrant {
        uint256 reviewId = jobToReview[jobId];
        require(reviews[reviewId].developer != address(0), "Job ID not found");
        require(reviews[reviewId].score == 0 && bytes(reviews[reviewId].reportURI).length == 0, "Already committed");

        // Decode the callback result
        (uint16 score, IssueSummary memory issues, bytes32 reportHash, string memory reportURI) =
            abi.decode(result, (uint16, IssueSummary, bytes32, string));

        this.commitCodeReview(reviewId, score, issues, reportHash, reportURI);
    }

    /// @notice Commit the final review results
    function commitCodeReview(
        uint256 reviewId,
        uint16 score,
        IssueSummary calldata issues,
        bytes32 reportHash,
        string calldata reportURI
    ) external {
        // Enforce callback security constraints
        require(msg.sender == address(this) || msg.sender == ASYNC_DELIVERY, "Unauthorized commit");
        require(reviews[reviewId].developer != address(0), "Review ID not found");
        require(reviews[reviewId].score == 0 && bytes(reviews[reviewId].reportURI).length == 0, "Already committed");

        reviews[reviewId].score = score;
        reviews[reviewId].issues = issues;
        reviews[reviewId].reportHash = reportHash;
        reviews[reviewId].reportURI = reportURI;

        emit ReviewCommitted(reviewId, score, reportHash, reportURI);
    }

    function mintCertificate(uint256 reviewId) external nonReentrant returns (uint256 tokenId) {
        Review storage review = reviews[reviewId];
        require(review.developer == msg.sender, "Only developer can mint certificate");
        require(!review.certificateMinted, "Certificate already minted");
        require(review.score >= passingScoreThreshold, "Score does not meet passing threshold");
        require(review.issues.critical == 0, "Cannot mint certificate with critical issues");
        require(certificateContract != address(0), "Certificate contract not set");

        review.certificateMinted = true;
        tokenId = ICodeProofCertificate(certificateContract).mint(msg.sender, review.reportURI);

        emit CertificateMinted(reviewId, tokenId, msg.sender);
    }

    function getDeveloperReviews(address developer) external view returns (uint256[] memory) {
        return developerReviews[developer];
    }

    function getReview(uint256 reviewId) external view returns (
        address developer,
        uint16 score,
        bool certificateMinted,
        bytes32 codeHash,
        bytes32 reportHash,
        string memory reportURI,
        IssueSummary memory issues
    ) {
        Review storage r = reviews[reviewId];
        return (r.developer, r.score, r.certificateMinted, r.codeHash, r.reportHash, r.reportURI, r.issues);
    }

    function getOwnerRecords(address owner, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256[] memory all = developerReviews[owner];
        if (offset >= all.length) {
            return new uint256[](0);
        }
        uint256 end = offset + limit;
        if (end > all.length) {
            end = all.length;
        }
        uint256 size = end - offset;
        uint256[] memory slice = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            slice[i] = all[offset + i];
        }
        return slice;
    }

    // Helper function to stringify bytes32
    function vmToString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i*2] = alphabet[uint8(value[i] >> 4)];
            str[1+i*2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(abi.encodePacked("0x", str));
    }
}
