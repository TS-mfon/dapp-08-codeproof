import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { registryAbi, trackerAbi } from "./abi.js";
import { clearProjection, getCheckpoint, setCheckpoint } from "./database.js";
import type { CodeProofDatabase } from "./database.js";
import { projectEvent } from "./projector.js";

const ritual = defineChain({
  id: 1979,
  name: "Ritual",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ritualfoundation.org"] } },
});

export function makeClient(rpcUrl: string): PublicClient {
  return createPublicClient({ chain: ritual, transport: http(rpcUrl) });
}

export async function checkpointIsCanonical(
  db: CodeProofDatabase,
  client: Pick<PublicClient, "getBlock">,
): Promise<boolean> {
  const checkpoint = getCheckpoint(db);
  if (!checkpoint) return true;
  try {
    const block = await client.getBlock({ blockNumber: checkpoint.blockNumber });
    return block.hash === checkpoint.blockHash;
  } catch {
    return false;
  }
}

export async function syncRange(options: {
  db: CodeProofDatabase;
  client: PublicClient;
  registryAddress: Address;
  trackerAddress: Address;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<void> {
  const { db, client, registryAddress, trackerAddress, fromBlock, toBlock } =
    options;
  if (toBlock < fromBlock) return;

  const logs = await client.getLogs({
    address: [registryAddress, trackerAddress],
    fromBlock,
    toBlock,
  });
  const blockCache = new Map<bigint, Awaited<ReturnType<typeof client.getBlock>>>();
  const txCache = new Map<string, Awaited<ReturnType<typeof client.getTransaction>>>();

  for (const log of logs) {
    if (
      log.blockNumber === null ||
      log.blockHash === null ||
      log.transactionHash === null ||
      log.logIndex === null
    ) {
      continue;
    }
    const isRegistry = log.address.toLowerCase() === registryAddress.toLowerCase();
    let decoded;
    try {
      decoded = decodeEventLog({
        abi: isRegistry ? registryAbi : trackerAbi,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
    } catch {
      continue;
    }
    let block = blockCache.get(log.blockNumber);
    if (!block) {
      block = await client.getBlock({ blockNumber: log.blockNumber });
      blockCache.set(log.blockNumber, block);
    }
    let transactionValue = 0n;
    if (decoded.eventName === "ReviewRequested") {
      let tx = txCache.get(log.transactionHash);
      if (!tx) {
        tx = await client.getTransaction({ hash: log.transactionHash });
        txCache.set(log.transactionHash, tx);
      }
      transactionValue = tx.value;
    }
    projectEvent(db, {
      eventName: decoded.eventName,
      args: decoded.args as Record<string, unknown>,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      timestamp: block.timestamp,
      transactionHash: log.transactionHash,
      transactionValue,
      logIndex: log.logIndex,
    });
  }

  const finalBlock = await client.getBlock({ blockNumber: toBlock });
  setCheckpoint(db, toBlock, finalBlock.hash);
}

export async function syncOnce(options: {
  db: CodeProofDatabase;
  client: PublicClient;
  registryAddress: Address;
  trackerAddress: Address;
  startBlock: bigint;
  confirmations: bigint;
  batchSize: bigint;
}): Promise<bigint> {
  const { db, client, startBlock, confirmations, batchSize } = options;
  if (!(await checkpointIsCanonical(db, client))) clearProjection(db);

  const head = await client.getBlockNumber();
  const confirmedHead = head > confirmations ? head - confirmations : 0n;
  const checkpoint = getCheckpoint(db);
  let fromBlock = checkpoint ? checkpoint.blockNumber + 1n : startBlock;

  while (fromBlock <= confirmedHead) {
    const toBlock =
      fromBlock + batchSize - 1n < confirmedHead
        ? fromBlock + batchSize - 1n
        : confirmedHead;
    await syncRange({ ...options, fromBlock, toBlock });
    fromBlock = toBlock + 1n;
  }
  return confirmedHead;
}
