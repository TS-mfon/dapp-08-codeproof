// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
    function depositFor(address user, uint256 lockDuration) external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address user) external view returns (uint256);
    function lockUntil(address user) external view returns (uint256);
}

interface IAsyncJobTracker {
    function hasPendingJobForSender(address sender) external view returns (bool);
}

interface IScheduler {
    function schedule(
        bytes memory data,
        uint32 gasLimit,
        uint32 startBlock,
        uint32 numCalls,
        uint32 frequency,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        address payer
    ) external returns (uint256 callId);

    function cancel(uint256 callId) external;
    function getCallState(uint256 callId) external view returns (uint8);
}

interface ITEEServiceRegistry {
    struct TEEServiceNode {
        address paymentAddress;
        address teeAddress;
        uint8 teeType;
        bytes publicKey;
        string endpoint;
        bytes32 certPubKeyHash;
        uint8 capability;
    }

    struct TEEServiceContext {
        TEEServiceNode node;
        bool isValid;
        bytes32 workloadId;
    }

    function getService(address addr, bool checkValidity)
        external
        view
        returns (TEEServiceContext memory);
}

interface ICodeProofCertificate {
    function mint(
        address to,
        uint256 reviewId,
        uint32 version,
        bytes32 reportHash,
        string calldata reportURI
    ) external returns (uint256 tokenId);
}

library RitualAddresses {
    address internal constant HTTP = address(0x0801);
    address internal constant LLM = address(0x0802);
    address internal constant JQ = address(0x0803);
    address internal constant SOVEREIGN_AGENT = address(0x080C);
    address internal constant ED25519 = address(0x0009);

    address internal constant RITUAL_WALLET =
        0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    address internal constant ASYNC_JOB_TRACKER =
        0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5;
    address internal constant ASYNC_DELIVERY =
        0x5A16214fF555848411544b005f7Ac063742f39F6;
    address internal constant TEE_SERVICE_REGISTRY =
        0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F;
    address internal constant SCHEDULER =
        0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B;
}

