"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type Address } from "viem";
import { teeRegistryAbi } from "@/lib/abi";
import { addresses, ritualChain } from "@/lib/ritual";

const client = createPublicClient({
  chain: ritualChain,
  transport: http(process.env.NEXT_PUBLIC_RITUAL_RPC_URL),
});

export type Executor = {
  address: Address;
  publicKey: `0x${string}`;
  capability: number;
};

async function getExecutor(capability: number): Promise<Executor | null> {
  const count = await client.readContract({
    address: addresses.teeRegistry,
    abi: teeRegistryAbi,
    functionName: "getIndexedServiceCountByCapability",
    args: [capability],
  });
  if (count === 0n) return null;
  const address = await client.readContract({
    address: addresses.teeRegistry,
    abi: teeRegistryAbi,
    functionName: "getIndexedServiceByCapabilityAt",
    args: [capability, 0n],
  });
  const service = await client.readContract({
    address: addresses.teeRegistry,
    abi: teeRegistryAbi,
    functionName: "getService",
    args: [address, true],
  });
  return {
    address,
    publicKey: service.node.publicKey,
    capability,
  };
}

export function useExecutors() {
  return useQuery({
    queryKey: ["ritual-executors"],
    queryFn: async () => {
      const llmExecutor = await getExecutor(1);
      return {
        llm: llmExecutor,
      };
    },
    staleTime: 60_000,
  });
}
