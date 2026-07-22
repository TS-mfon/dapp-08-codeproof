import { parseAbi } from "viem";

export const registryAbi = parseAbi([
  "event ReviewRequested(uint256 indexed id,uint32 indexed version,address indexed owner,uint8 mode,bytes32 sourceHash,string sourceURI,bool provenanceVerified)",
  "event ReviewStatusUpdated(uint256 indexed id,uint32 indexed version,uint8 status,string reason)",
  "event SourceFetched(uint256 indexed id,uint32 indexed version,bytes32 sourceHash)",
  "event LLMReviewScheduled(uint256 indexed id,uint32 indexed version,uint256 indexed scheduleId)",
  "event DeepReviewSubmitted(uint256 indexed id,uint32 indexed version,bytes32 indexed jobId)",
  "event ReviewCommitted(uint256 indexed id,uint32 indexed version,uint16 score,bytes32 reportHash,string reportURI,(uint16 critical,uint16 high,uint16 medium,uint16 low,uint16 gas) issues)",
  "event ReviewVisibilityUpdated(uint256 indexed id,bool publicShare)",
  "event CertificateMinted(uint256 indexed reviewId,uint32 indexed version,uint256 indexed tokenId)",
]);

export const trackerAbi = parseAbi([
  "event JobAdded(address indexed executor,bytes32 indexed jobId,address indexed precompileAddress,uint256 commitBlock,bytes precompileInput,address senderAddress,bytes32 previousBlockHash,uint256 previousBlockNumber,uint256 previousBlockTimestamp,uint256 ttl,uint256 createdAt)",
  "event Phase1Settled(bytes32 indexed jobId,address indexed executor,uint256 settledBlock)",
  "event ResultDelivered(bytes32 indexed jobId,address indexed target,bool success)",
  "event JobRemoved(address indexed executor,bytes32 indexed jobId,bool indexed completed)",
]);
