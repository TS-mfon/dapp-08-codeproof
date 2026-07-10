import { useState, useEffect } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { REGISTRY_ABI } from "../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS, SYSTEM_CONTRACTS } from "../lib/ritual";
import type { Hex } from "viem";

export type TxState = 
  | "IDLE" 
  | "CONFIRMING" 
  | "SUBMITTED" 
  | "COMMITTED" 
  | "EXECUTING" 
  | "SETTLED" 
  | "FAILED" 
  | "EXPIRED";

export function useAsyncTransaction() {
  const [state, setState] = useState<TxState>("IDLE");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [reviewId, setReviewId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocksElapsed, setBlocksElapsed] = useState(0);
  const [startBlock, setStartBlock] = useState<bigint | null>(null);

  const publicClient = usePublicClient();

  // Watch for block changes to track elapsed time / timeout
  useEffect(() => {
    if (state !== "COMMITTED" && state !== "EXECUTING") return;
    if (!publicClient || !startBlock) return;

    const unwatch = publicClient.watchBlockNumber({
      onBlockNumber: (blockNumber) => {
        const elapsed = Number(blockNumber - startBlock);
        setBlocksElapsed(elapsed);

        // Update state to EXECUTING after a few blocks
        if (state === "COMMITTED" && elapsed > 2) {
          setState("EXECUTING");
        }

        // Timeout check (e.g., 500 blocks ~ 3 minutes)
        if (elapsed > 500) {
          setState("EXPIRED");
          setError("Review execution timed out.");
        }
      }
    });

    return () => unwatch();
  }, [state, publicClient, startBlock]);

  // Watch for the ReviewRequested event to extract the reviewId
  useWatchContractEvent({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    eventName: "ReviewRequested",
    onLogs(logs) {
      if (state !== "SUBMITTED" && state !== "COMMITTED") return;
      for (const log of logs) {
        // Match the transaction hash
        if (log.transactionHash === txHash) {
          const id = (log as any).args.id;
          if (id !== undefined) {
            setReviewId(id);
          }
        }
      }
    }
  });

  // Watch for the ReviewCommitted event to complete the transaction
  useWatchContractEvent({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    eventName: "ReviewCommitted",
    onLogs(logs) {
      for (const log of logs) {
        const id = (log as any).args.id;
        if (reviewId !== null && id !== undefined && BigInt(id) === BigInt(reviewId)) {
          setState("SETTLED");
        }
      }
    }
  });

  const sendReviewTransaction = async (sendTxFn: () => Promise<Hex>) => {
    setState("CONFIRMING");
    setError(null);
    setBlocksElapsed(0);
    setReviewId(null);

    try {
      const hash = await sendTxFn();
      setTxHash(hash);
      setState("SUBMITTED");

      if (!publicClient) {
        setState("COMMITTED");
        return hash;
      }

      // Wait for the transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStartBlock(receipt.blockNumber);
      setState("COMMITTED");
      return hash;
    } catch (err: any) {
      setState("FAILED");
      let friendlyError = "Transaction failed";
      if (err?.message) {
        const msg = err.message.toLowerCase();
        if (msg.includes("user rejected") || msg.includes("user denied") || err?.code === 4001) {
          friendlyError = "Transaction rejected by user.";
        } else if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
          friendlyError = "Insufficient RITUAL balance to cover transaction and gas fees.";
        } else if (msg.includes("revert")) {
          friendlyError = "Transaction reverted by the network. Please verify contract code or network status.";
        } else {
          friendlyError = err.message.split("\n")[0] || "Transaction failed";
        }
      }
      setError(friendlyError);
      throw err;
    }
  };

  const reset = () => {
    setState("IDLE");
    setTxHash(null);
    setReviewId(null);
    setError(null);
    setBlocksElapsed(0);
    setStartBlock(null);
  };

  return {
    state,
    txHash,
    reviewId,
    error,
    blocksElapsed,
    sendReviewTransaction,
    reset
  };
}
