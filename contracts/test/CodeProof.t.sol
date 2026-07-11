// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CodeProofReviewRegistry.sol";
import "../src/CodeProofCertificate.sol";

contract CodeProofTest is Test {
    CodeProofReviewRegistry public registry;
    CodeProofCertificate public certificate;

    address public constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;
    address public constant SOVEREIGN_AGENT_PRECOMPILE = 0x000000000000000000000000000000000000080C;
    address public constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;

    address public developer = address(0x1111);
    address public executor = address(0x2222);

    bytes32 public codeHash = keccak256("code");
    string public sourceURI = "https://github.com/user/repo/file.sol";

    function setUp() public {
        registry = new CodeProofReviewRegistry();
        certificate = new CodeProofCertificate(address(registry));
        registry.setCertificateContract(address(certificate));

        // Deal some RITUAL tokens (represented by native ether on testnet)
        vm.deal(developer, 10 ether);
    }

    // Helper to build precompile input for mockCall matching
    function getPrecompileInput(uint64 ttl) internal view returns (bytes memory) {
        string memory prompt = string(abi.encodePacked(
            "Conduct a detailed smart contract review of the Solidity file at: ", sourceURI,
            ". Verify the content hash matches: ", vmToString(codeHash),
            ". Return a JSON containing exact counts for issue categories (critical, high, medium, low, gas), a score from 0-100, and a report hash."
        ));

        CodeProofReviewRegistry.StorageRef memory emptyRef = CodeProofReviewRegistry.StorageRef("", "", "");

        return abi.encode(
            executor,                             // 0: TEE executor
            uint256(ttl),                         // 1: TTL
            hex"",                                // 2: userPublicKey (unencrypted)
            uint64(5),                            // 3: pollIntervalBlocks
            uint64(1000),                         // 4: maxPollBlock
            "{{TASK_ID}}",                        // 5: taskIdMarker
            address(registry),                    // 6: deliveryTarget
            registry.onSovereignAgentResult.selector, // 7: deliverySelector
            uint256(1_500_000),                   // 8: deliveryGasLimit
            uint256(1_000_000_000),               // 9: deliveryMaxFeePerGas
            uint256(100_000_000),                 // 10: deliveryMaxPriorityFeePerGas
            uint16(6),                            // 11: cliType (6 = zeroclaw)
            prompt,                               // 12: prompt
            hex"",                                // 13: encryptedSecrets
            emptyRef,                             // 14: convoHistory
            emptyRef,                             // 15: output
            new CodeProofReviewRegistry.StorageRef[](0), // 16: skills
            emptyRef,                             // 17: systemPrompt
            "zai-org/GLM-4.7-FP8",                // 18: model
            new string[](0),                      // 19: tools
            uint16(10),                           // 20: maxTurns
            uint32(4096),                         // 21: maxTokens
            ""                                    // 22: rpcUrls
        );
    }

    function vmToString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i*2] = alphabet[uint8(value[i] >> 4)];
            str[1+i*2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(abi.encodePacked("0x", str));
    }

    function test_requestCodeReview() public {
        vm.startPrank(developer);

        // Mock the RitualWallet depositFor call
        vm.mockCall(
            RITUAL_WALLET,
            abi.encodeWithSelector(IRitualWallet.depositFor.selector, developer, 100),
            ""
        );

        // Mock the Sovereign Agent precompile call
        bytes32 expectedJobId = keccak256("jobId");
        bytes memory mockPrecompileOutput = abi.encode(bytes("simmedInput"), abi.encode(expectedJobId));
        bytes memory expectedInput = getPrecompileInput(100);
        vm.mockCall(SOVEREIGN_AGENT_PRECOMPILE, expectedInput, mockPrecompileOutput);

        uint256 reviewId = registry.requestCodeReview{value: 0.05 ether}(
            codeHash,
            sourceURI,
            executor,
            100
        );

        assertEq(reviewId, 0);
        assertEq(registry.jobToReview(expectedJobId), 0);

        uint256 rId = registry.getOwnerRecords(developer, 0, 1)[0];
        assertEq(rId, 0); // reviewId is 0

        vm.stopPrank();
    }

    function test_callback_commitReview() public {
        // First register a job
        vm.startPrank(developer);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSelector(IRitualWallet.depositFor.selector, developer, 100), "");
        bytes32 expectedJobId = keccak256("jobId");
        bytes memory mockPrecompileOutput = abi.encode(bytes("simmedInput"), abi.encode(expectedJobId));
        bytes memory expectedInput = getPrecompileInput(100);
        vm.mockCall(SOVEREIGN_AGENT_PRECOMPILE, expectedInput, mockPrecompileOutput);

        registry.requestCodeReview{value: 0.05 ether}(codeHash, sourceURI, executor, 100);
        vm.stopPrank();

        // Simulate callback from AsyncDelivery
        CodeProofReviewRegistry.IssueSummary memory issues = CodeProofReviewRegistry.IssueSummary({
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
            gas: 0
        });
        bytes32 reportHash = keccak256("report");
        string memory reportURI = "ipfs://QmReport";

        bytes memory callbackResult = abi.encode(uint16(85), issues, reportHash, reportURI);

        vm.prank(ASYNC_DELIVERY);
        registry.onSovereignAgentResult(expectedJobId, callbackResult);

        // Verify review details committed
        (address dev, uint16 score, bool certMinted, bytes32 cHash, bytes32 rHash, string memory rURI, CodeProofReviewRegistry.IssueSummary memory returnedIssues) = registry.getReview(0);
        assertEq(dev, developer);
        assertEq(score, 85);
        assertEq(certMinted, false);
        assertEq(cHash, codeHash);
        assertEq(rHash, reportHash);
        assertEq(rURI, reportURI);
    }

    function test_callback_fails_unauthorized() public {
        bytes32 expectedJobId = keccak256("jobId");
        bytes memory callbackResult = abi.encode(uint16(85), CodeProofReviewRegistry.IssueSummary(0, 0, 0, 0, 0), keccak256(""), "");

        vm.prank(address(0xdead));
        vm.expectRevert("Only async delivery allowed");
        registry.onSovereignAgentResult(expectedJobId, callbackResult);
    }

    function test_mintCertificate_success() public {
        // Set up committed review
        vm.startPrank(developer);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSelector(IRitualWallet.depositFor.selector, developer, 100), "");
        bytes32 expectedJobId = keccak256("jobId");
        bytes memory expectedInput = getPrecompileInput(100);
        vm.mockCall(SOVEREIGN_AGENT_PRECOMPILE, expectedInput, abi.encode(bytes(""), abi.encode(expectedJobId)));
        registry.requestCodeReview{value: 0.05 ether}(codeHash, sourceURI, executor, 100);
        vm.stopPrank();

        // Deliver callback with passing results (score 90, 0 criticals)
        CodeProofReviewRegistry.IssueSummary memory issues = CodeProofReviewRegistry.IssueSummary(0, 0, 1, 2, 0);
        bytes memory callbackResult = abi.encode(uint16(90), issues, keccak256("report"), "ipfs://QmReport");
        vm.prank(ASYNC_DELIVERY);
        registry.onSovereignAgentResult(expectedJobId, callbackResult);

        // Mint certificate
        vm.prank(developer);
        uint256 tokenId = registry.mintCertificate(0);
        assertEq(tokenId, 0);

        // Verify certificate details
        assertEq(certificate.ownerOf(0), developer);
        assertEq(certificate.tokenURI(0), "ipfs://QmReport");
        assertTrue(certificate.locked(0));

        (, , bool certMinted, , , , ) = registry.getReview(0);
        assertTrue(certMinted);
    }

    function test_mintCertificate_fails_low_score() public {
        // Set up committed review
        vm.startPrank(developer);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSelector(IRitualWallet.depositFor.selector, developer, 100), "");
        bytes32 expectedJobId = keccak256("jobId");
        bytes memory expectedInput = getPrecompileInput(100);
        vm.mockCall(SOVEREIGN_AGENT_PRECOMPILE, expectedInput, abi.encode(bytes(""), abi.encode(expectedJobId)));
        registry.requestCodeReview{value: 0.05 ether}(codeHash, sourceURI, executor, 100);
        vm.stopPrank();

        // Deliver callback with low score (55, 0 criticals)
        CodeProofReviewRegistry.IssueSummary memory issues = CodeProofReviewRegistry.IssueSummary(0, 0, 1, 2, 0);
        bytes memory callbackResult = abi.encode(uint16(55), issues, keccak256("report"), "ipfs://QmReport");
        vm.prank(ASYNC_DELIVERY);
        registry.onSovereignAgentResult(expectedJobId, callbackResult);

        // Mint certificate should fail
        vm.prank(developer);
        vm.expectRevert("Score does not meet passing threshold");
        registry.mintCertificate(0);
    }

    function test_mintCertificate_fails_critical_issues() public {
        // Set up committed review
        vm.startPrank(developer);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSelector(IRitualWallet.depositFor.selector, developer, 100), "");
        bytes32 expectedJobId = keccak256("jobId");
        bytes memory expectedInput = getPrecompileInput(100);
        vm.mockCall(SOVEREIGN_AGENT_PRECOMPILE, expectedInput, abi.encode(bytes(""), abi.encode(expectedJobId)));
        registry.requestCodeReview{value: 0.05 ether}(codeHash, sourceURI, executor, 100);
        vm.stopPrank();

        // Deliver callback with high score but 1 critical issue
        CodeProofReviewRegistry.IssueSummary memory issues = CodeProofReviewRegistry.IssueSummary(1, 0, 1, 2, 0);
        bytes memory callbackResult = abi.encode(uint16(85), issues, keccak256("report"), "ipfs://QmReport");
        vm.prank(ASYNC_DELIVERY);
        registry.onSovereignAgentResult(expectedJobId, callbackResult);

        // Mint certificate should fail
        vm.prank(developer);
        vm.expectRevert("Cannot mint certificate with critical issues");
        registry.mintCertificate(0);
    }

    function test_soulbound_transfers_revert() public {
        // Setup certificate
        vm.startPrank(developer);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSelector(IRitualWallet.depositFor.selector, developer, 100), "");
        bytes32 expectedJobId = keccak256("jobId");
        bytes memory expectedInput = getPrecompileInput(100);
        vm.mockCall(SOVEREIGN_AGENT_PRECOMPILE, expectedInput, abi.encode(bytes(""), abi.encode(expectedJobId)));
        registry.requestCodeReview{value: 0.05 ether}(codeHash, sourceURI, executor, 100);
        vm.stopPrank();

        CodeProofReviewRegistry.IssueSummary memory issues = CodeProofReviewRegistry.IssueSummary(0, 0, 0, 0, 0);
        bytes memory callbackResult = abi.encode(uint16(90), issues, keccak256("report"), "ipfs://QmReport");
        vm.prank(ASYNC_DELIVERY);
        registry.onSovereignAgentResult(expectedJobId, callbackResult);

        vm.prank(developer);
        uint256 tokenId = registry.mintCertificate(0);

        // Transfer should revert
        vm.prank(developer);
        vm.expectRevert("Soulbound: transfer disabled");
        certificate.transferFrom(developer, address(0x2222), tokenId);
    }
}
