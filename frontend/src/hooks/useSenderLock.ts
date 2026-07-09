import { useAccount, useReadContract } from "wagmi";

const ASYNC_JOB_TRACKER = "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5" as const;

const asyncJobTrackerAbi = [
  {
    type: "function",
    name: "hasPendingJobForSender",
    inputs: [{ name: "sender", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

export function useSenderLock() {
  const { address } = useAccount();

  const { data: isLocked, refetch } = useReadContract({
    address: ASYNC_JOB_TRACKER,
    abi: asyncJobTrackerAbi,
    functionName: "hasPendingJobForSender",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5_000 },
  });

  return {
    isLocked: isLocked ?? false,
    refetch,
    message: isLocked ? "You have a pending async job — wait for settlement before submitting another." : null,
  };
}
