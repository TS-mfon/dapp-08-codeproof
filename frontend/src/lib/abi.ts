import { parseAbi } from "viem";

export const registryAbi = parseAbi([
  "function nextReviewId() view returns (uint256)",
  "function fastReviewFee() view returns (uint256)",
  "function deepReviewFee() view returns (uint256)",
  "function passingScoreThreshold() view returns (uint16)",
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
  "function treasury() view returns (address)",
  "function getOwnerRecords(address account,uint256 offset,uint256 limit) view returns (uint256[])",
  "function getReview(uint256 reviewId) view returns ((address owner,uint8 mode,uint8 status,uint64 createdBlock,uint64 updatedBlock,uint64 pendingUntilBlock,uint32 versionCount,bool publicShare,bool provenanceVerified,bytes32 provenanceKeyHash,bytes32 latestHash,string latestURI))",
  "function getVersion(uint256 reviewId,uint32 version) view returns ((uint8 mode,uint8 status,uint16 score,bool certificateMinted,bytes32 sourceHash,string sourceURI,bytes32 instructionHash,string instructionURI,bytes32 reportHash,string reportURI,bytes32 jobId,uint256 scheduleId,(uint16 critical,uint16 high,uint16 medium,uint16 low,uint16 gas) issues))",
  "function getReport(uint256 reviewId,uint32 version) view returns (string)",
  "function requestReview(string source,string language,(bytes publicKey,bytes signature) proof,(address executor,uint64 ttl) config) payable returns (uint256 reviewId)",
  "function setPublicShare(uint256 reviewId,bool enabled)",
  "function mintCertificate(uint256 reviewId,uint32 version) returns (uint256 tokenId)",
  "function setPaused(bool value)",
  "function setFees(uint256 fastFee,uint256 deepFee)",
  "function setPassingScoreThreshold(uint16 threshold)",
  "event ReviewRequested(uint256 indexed id,uint32 indexed version,address indexed owner,uint8 mode,bytes32 sourceHash,string sourceURI,bool provenanceVerified)",
]);

export const ritualWalletAbi = parseAbi([
  "function deposit(uint256 lockDuration) payable",
  "function balanceOf(address user) view returns (uint256)",
  "function lockUntil(address user) view returns (uint256)",
]);

export const trackerAbi = parseAbi([
  "function hasPendingJobForSender(address sender) view returns (bool)",
]);

export const teeRegistryAbi = parseAbi([
  "function getCapabilityIndexStatus() view returns (uint256 cursor,uint256 total,bool initialized,bool finalized)",
  "function getIndexedServiceCountByCapability(uint8 capability) view returns (uint256 count)",
  "function getIndexedServiceByCapabilityAt(uint8 capability,uint256 index) view returns (address teeAddress)",
  "function getService(address addr,bool checkValidity) view returns (((address paymentAddress,address teeAddress,uint8 teeType,bytes publicKey,string endpoint,bytes32 certPubKeyHash,uint8 capability) node,bool isValid,bytes32 workloadId))",
]);
