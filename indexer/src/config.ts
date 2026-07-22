import type { Address } from "viem";

const address = (value: string | undefined, fallback: Address): Address =>
  (value || fallback) as Address;

export const config = {
  rpcUrl: process.env.RITUAL_RPC_URL || "https://rpc.ritualfoundation.org",
  registryAddress: address(
    process.env.REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
    "0x0000000000000000000000000000000000000000",
  ),
  trackerAddress: address(
    process.env.ASYNC_JOB_TRACKER_ADDRESS,
    "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5",
  ),
  port: Number(process.env.INDEXER_PORT || 4000),
  dbPath: process.env.INDEXER_DB_PATH || "./data/codeproof.db",
  startBlock: BigInt(process.env.INDEXER_START_BLOCK || 0),
  confirmations: BigInt(process.env.INDEXER_CONFIRMATIONS || 12),
  batchSize: BigInt(process.env.INDEXER_BATCH_SIZE || 1_000),
  pollMs: Number(process.env.INDEXER_POLL_MS || 2_000),
};
