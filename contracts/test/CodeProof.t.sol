// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CodeProofCertificate} from "../src/CodeProofCertificate.sol";
import {CodeProofReviewRegistry} from "../src/CodeProofReviewRegistry.sol";
import {ITEEServiceRegistry, RitualAddresses} from "../src/RitualInterfaces.sol";

contract CodeProofTest is Test {
    CodeProofReviewRegistry internal registry;
    CodeProofCertificate internal certificate;

    address internal treasury = makeAddr("treasury");
    address internal developer = makeAddr("developer");
    address internal llmExecutor = makeAddr("llmExecutor");
    address internal attacker = makeAddr("attacker");
    string internal source =
        "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24; contract Safe {}";

    function setUp() public {
        registry = new CodeProofReviewRegistry(treasury);
        certificate = new CodeProofCertificate(address(registry));
        registry.setCertificateContract(address(certificate));
        vm.deal(developer, 100 ether);
        _mockExecutor(llmExecutor);
        vm.mockCall(RitualAddresses.RITUAL_WALLET, bytes(""), bytes(""));
    }

    function testSimulationCreatesPendingReview() public {
        vm.mockCall(
            RitualAddresses.LLM,
            bytes(""),
            abi.encode(bytes("simulated"), bytes(""))
        );

        vm.prank(developer);
        uint256 id = registry.requestReview{value: 0.03 ether}(
            source, "solidity", _emptyProof(), _config()
        );

        CodeProofReviewRegistry.Review memory review = registry.getReview(id);
        assertEq(review.owner, developer);
        assertEq(
            uint8(review.status),
            uint8(CodeProofReviewRegistry.ReviewStatus.AI_REQUESTED)
        );
        assertEq(registry.ownerRecordCount(developer), 1);
        assertEq(treasury.balance, registry.fastReviewFee());
    }

    function testFulfilledReplayCommitsStructuredReview() public {
        string memory json =
            '{"score":91,"issues":{"critical":0,"high":1,"medium":2,"low":3,"gas":4},"summary":"Good","risks":[]}';
        _mockReviewJson(json, 91, 0, 1, 2, 3, 4);
        vm.mockCall(
            RitualAddresses.LLM,
            bytes(""),
            abi.encode(bytes("simulated"), _actualOutput(json))
        );

        vm.prank(developer);
        uint256 id = registry.requestReview{value: 0.03 ether}(
            source, "solidity", _emptyProof(), _config()
        );

        CodeProofReviewRegistry.ReviewVersion memory version =
            registry.getVersion(id, 1);
        assertEq(version.score, 91);
        assertEq(version.issues.high, 1);
        assertEq(version.reportHash, keccak256(bytes(json)));
        assertEq(uint8(version.status), 3);

        vm.prank(developer);
        assertEq(registry.getReport(id, 1), json);
    }

    function testOptionalEd25519Provenance() public {
        bytes memory publicKey = new bytes(32);
        bytes memory signature = new bytes(64);
        vm.mockCall(RitualAddresses.ED25519, bytes(""), abi.encode(uint256(1)));
        vm.mockCall(
            RitualAddresses.LLM,
            bytes(""),
            abi.encode(bytes("simulated"), bytes(""))
        );

        vm.prank(developer);
        uint256 id = registry.requestReview{value: 0.03 ether}(
            source,
            "solidity",
            CodeProofReviewRegistry.Provenance(publicKey, signature),
            _config()
        );

        CodeProofReviewRegistry.Review memory review = registry.getReview(id);
        assertTrue(review.provenanceVerified);
        assertEq(review.provenanceKeyHash, keccak256(publicKey));
    }

    function testPrivateReportRejectsOtherAccounts() public {
        string memory json =
            '{"score":50,"issues":{"critical":1,"high":1,"medium":0,"low":0,"gas":0},"summary":"Risk","risks":[]}';
        _mockReviewJson(json, 50, 1, 1, 0, 0, 0);
        vm.mockCall(
            RitualAddresses.LLM,
            bytes(""),
            abi.encode(bytes("simulated"), _actualOutput(json))
        );

        vm.prank(developer);
        uint256 id = registry.requestReview{value: 0.03 ether}(
            source, "solidity", _emptyProof(), _config()
        );

        vm.prank(attacker);
        vm.expectRevert(CodeProofReviewRegistry.Unauthorized.selector);
        registry.getReport(id, 1);
    }

    function testPassingReviewMintsSoulboundCertificate() public {
        string memory json =
            '{"score":91,"issues":{"critical":0,"high":1,"medium":0,"low":0,"gas":0},"summary":"Pass","risks":[]}';
        _mockReviewJson(json, 91, 0, 1, 0, 0, 0);
        vm.mockCall(
            RitualAddresses.LLM,
            bytes(""),
            abi.encode(bytes("simulated"), _actualOutput(json))
        );

        vm.startPrank(developer);
        uint256 id = registry.requestReview{value: 0.03 ether}(
            source, "solidity", _emptyProof(), _config()
        );
        uint256 tokenId = registry.mintCertificate(id, 1);
        vm.stopPrank();

        assertEq(certificate.ownerOf(tokenId), developer);
        assertTrue(certificate.locked(tokenId));
        vm.prank(developer);
        vm.expectRevert(CodeProofCertificate.Soulbound.selector);
        certificate.transferFrom(developer, attacker, tokenId);
    }

    function testPaginationAndVisibility() public {
        vm.mockCall(
            RitualAddresses.LLM,
            bytes(""),
            abi.encode(bytes("simulated"), bytes(""))
        );
        vm.startPrank(developer);
        registry.requestReview{value: 0.03 ether}(
            source, "solidity", _emptyProof(), _config()
        );
        registry.requestReview{value: 0.03 ether}(
            source, "python", _emptyProof(), _config()
        );
        registry.setPublicShare(1, true);
        vm.stopPrank();

        uint256[] memory records = registry.getOwnerRecords(developer, 1, 10);
        assertEq(records.length, 1);
        assertEq(records[0], 1);
        assertTrue(registry.getReview(1).publicShare);
    }

    function _emptyProof()
        internal
        pure
        returns (CodeProofReviewRegistry.Provenance memory)
    {
        return CodeProofReviewRegistry.Provenance("", "");
    }

    function _config()
        internal
        view
        returns (CodeProofReviewRegistry.LLMConfig memory)
    {
        return CodeProofReviewRegistry.LLMConfig(llmExecutor, 300);
    }

    function _actualOutput(string memory json) internal pure returns (bytes memory) {
        bytes[] memory toolCalls = new bytes[](0);
        bytes memory messageData = abi.encode("assistant", json, "", 0, toolCalls);
        bytes[] memory choices = new bytes[](1);
        choices[0] = abi.encode(uint256(0), "stop", messageData);
        bytes memory completionData =
            abi.encode("", "", uint256(0), "", "", "", uint256(1), choices, bytes(""));
        return abi.encode(
            false,
            completionData,
            bytes(""),
            "",
            CodeProofReviewRegistry.StorageRef("", "", "")
        );
    }

    function _mockExecutor(address executor) internal {
        ITEEServiceRegistry.TEEServiceNode memory node =
            ITEEServiceRegistry.TEEServiceNode({
                paymentAddress: executor,
                teeAddress: executor,
                teeType: 1,
                publicKey: hex"01",
                endpoint: "",
                certPubKeyHash: bytes32(0),
                capability: 1
            });
        ITEEServiceRegistry.TEEServiceContext memory context =
            ITEEServiceRegistry.TEEServiceContext({
                node: node,
                isValid: true,
                workloadId: bytes32(0)
            });
        vm.mockCall(
            RitualAddresses.TEE_SERVICE_REGISTRY,
            abi.encodeWithSelector(
                ITEEServiceRegistry.getService.selector,
                executor,
                true
            ),
            abi.encode(context)
        );
    }

    function _mockReviewJson(
        string memory json,
        uint256 score,
        uint256 critical,
        uint256 high,
        uint256 medium,
        uint256 low,
        uint256 gasIssues
    ) internal {
        _mockJq(".score", json, score);
        _mockJq(".issues.critical", json, critical);
        _mockJq(".issues.high", json, high);
        _mockJq(".issues.medium", json, medium);
        _mockJq(".issues.low", json, low);
        _mockJq(".issues.gas", json, gasIssues);
    }

    function _mockJq(string memory query, string memory json, uint256 value)
        internal
    {
        vm.mockCall(
            RitualAddresses.JQ,
            abi.encode(query, json, uint8(1)),
            abi.encode(value)
        );
    }
}
