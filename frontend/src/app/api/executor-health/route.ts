import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { teeRegistryAbi } from "@/lib/abi";

const rpcUrl =
  process.env.RITUAL_RPC_URL || "https://rpc.ritualfoundation.org";
const teeRegistry =
  "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as const;
const llmPrecompile = "0x0000000000000000000000000000000000000802";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = createPublicClient({ transport: http(rpcUrl) });
    const count = await client.readContract({
      address: teeRegistry,
      abi: teeRegistryAbi,
      functionName: "getIndexedServiceCountByCapability",
      args: [1],
    });

    if (count === 0n) {
      return NextResponse.json({
        healthy: false,
        reason: "No Ritual LLM executor is currently registered.",
      });
    }

    const executor = await client.readContract({
      address: teeRegistry,
      abi: teeRegistryAbi,
      functionName: "getIndexedServiceByCapabilityAt",
      args: [1, 0n],
    });
    const service = await client.readContract({
      address: teeRegistry,
      abi: teeRegistryAbi,
      functionName: "getService",
      args: [executor, true],
    });
    const healthUrl = new URL("/health", service.node.endpoint);
    const response = await fetch(healthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new Error(`Executor health returned HTTP ${response.status}.`);
    }

    const health = (await response.json()) as {
      handlers?: Record<
        string,
        {
          status?: string;
          verified_endpoints?: number;
          pending_endpoints?: number;
        }
      >;
    };
    const llm = health.handlers?.[llmPrecompile];
    const healthy =
      llm?.status === "ok" &&
      (llm.verified_endpoints ?? 0) > 0 &&
      (llm.pending_endpoints ?? 0) === 0;

    return NextResponse.json({
      healthy,
      executor,
      reason: healthy
        ? ""
        : "Ritual's LLM endpoint certificate is still being verified.",
    });
  } catch {
    return NextResponse.json({
      healthy: false,
      reason: "Ritual's LLM executor health could not be verified.",
    });
  }
}
