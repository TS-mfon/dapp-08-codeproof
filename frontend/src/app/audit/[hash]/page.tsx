"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CircleDotDashed,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  decodeEventLog,
  type Hex,
  TransactionReceiptNotFoundError,
} from "viem";
import { usePublicClient } from "wagmi";
import { registryAbi } from "@/lib/abi";
import { addresses } from "@/lib/ritual";

type AuditPoll = {
  reviewId?: bigint;
  status?: number;
  reason?: string;
  stage: "submitted" | "processing" | "completed" | "failed" | "unavailable";
};

const unavailableAfterMs = 120_000;
const knownFailedAudits: Record<string, string> = {
  "0xfb18ef142b02af5bebaa6152a9041ad4120e3c85d0c99a8570952a78463e1604":
    "The active Ritual LLM executor could not verify its service certificate. Retry when the executor is healthy.",
};

export default function AuditProgressPage() {
  const params = useParams<{ hash: Hex }>();
  const router = useRouter();
  const publicClient = usePublicClient();
  const [startedAt] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["audit-progress", params.hash],
    queryFn: async (): Promise<AuditPoll> => {
      if (!publicClient) return { stage: "submitted" };

      let receipt;
      try {
        receipt = await publicClient.getTransactionReceipt({
          hash: params.hash,
        });
      } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) {
          const knownFailure = knownFailedAudits[params.hash.toLowerCase()];
          if (knownFailure) {
            return { reviewId: 0n, status: 4, reason: knownFailure, stage: "failed" };
          }
          if (Date.now() - startedAt >= unavailableAfterMs) {
            return { stage: "unavailable" };
          }
          return { stage: "submitted" };
        }
        throw error;
      }

      let reviewId: bigint | undefined;
      let receiptStatus: number | undefined;
      let reason = "";

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== addresses.registry.toLowerCase()) {
          continue;
        }
        try {
          const event = decodeEventLog({
            abi: registryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === "ReviewRequested") {
            reviewId = event.args.id;
          }
          if (event.eventName === "ReviewStatusUpdated") {
            receiptStatus = event.args.status;
            reason = event.args.reason;
          }
          if (event.eventName === "ReviewCommitted") {
            receiptStatus = 3;
          }
        } catch {
          // Other Ritual system logs are expected in the settled receipt.
        }
      }

      if (reviewId === undefined) {
        return { stage: "processing" };
      }

      const review = await publicClient.readContract({
        address: addresses.registry,
        abi: registryAbi,
        functionName: "getReview",
        args: [reviewId],
      });
      const status = Number(review.status || receiptStatus || 0);

      if (status === 3) {
        return { reviewId, status, stage: "completed" };
      }
      if (status === 4 || status === 5 || status === 6) {
        return {
          reviewId,
          status,
          reason: reason || "The Ritual LLM executor could not complete this audit.",
          stage: "failed",
        };
      }
      return { reviewId, status, stage: "processing" };
    },
    refetchInterval: (current) =>
      current.state.data?.stage === "completed" ||
      current.state.data?.stage === "failed" ||
      current.state.data?.stage === "unavailable"
        ? false
        : 2_500,
    retry: true,
  });

  useEffect(() => {
    if (query.data?.stage === "completed" && query.data.reviewId !== undefined) {
      router.replace(`/result/${query.data.reviewId}`);
    }
  }, [query.data, router]);

  if (query.data?.stage === "failed") {
    return (
      <section className="ritual-stage ritual-failed">
        <div className="failure-mark">
          <AlertTriangle size={30} />
        </div>
        <span className="eyebrow">The invocation failed</span>
        <h1>The executor returned without an audit.</h1>
        <p>{cleanFailureReason(query.data.reason)}</p>
        <div className="ritual-actions">
          <Link className="audit-button" href="/">
            <RefreshCw size={16} />
            Try again
          </Link>
          <a
            className="back-button"
            href={`https://explorer.ritualfoundation.org/tx/${params.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        </div>
      </section>
    );
  }

  if (query.data?.stage === "unavailable") {
    return (
      <section className="ritual-stage ritual-failed">
        <div className="failure-mark">
          <AlertTriangle size={30} />
        </div>
        <span className="eyebrow">Transaction unavailable</span>
        <h1>Ritual RPC did not return this transaction.</h1>
        <p>
          The transaction may have been dropped, replaced, or removed after a
          network reset. Check the explorer before submitting the audit again.
        </p>
        <div className="ritual-actions">
          <Link className="audit-button" href="/">
            <RefreshCw size={16} />
            Start a new audit
          </Link>
          <a
            className="back-button"
            href={`https://explorer.ritualfoundation.org/tx/${params.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        </div>
      </section>
    );
  }

  const stage =
    query.data?.stage === "processing"
      ? "Ritual LLM is reviewing your code"
      : "Waiting for the invocation";

  return (
    <section className="ritual-stage">
      <div className="ritual-loader" aria-hidden="true">
        <CircleDotDashed className="outer-glyph" />
        <Sparkles className="inner-glyph" />
      </div>
      <span className="eyebrow">Audit in progress</span>
      <h1>{stage}</h1>
      <p>
        Keep this page open. The result will appear when the async Ritual
        transaction settles.
      </p>
      <span className="transaction-rune">{shortHash(params.hash)}</span>
    </section>
  );
}

function shortHash(hash: string) {
  return `${hash.slice(0, 12)}...${hash.slice(-10)}`;
}

function cleanFailureReason(reason?: string) {
  if (!reason) return "The Ritual LLM executor could not complete this audit.";
  if (reason.includes("failed to get cert hash")) {
    return "The active Ritual LLM executor could not verify its service certificate. Retry when the executor is healthy.";
  }
  return reason;
}
