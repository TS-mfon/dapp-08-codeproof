"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ExternalLink,
  FileJson2,
  LockKeyhole,
  Share2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { encodeFunctionData } from "viem";
import { useAccount, useSendTransaction } from "wagmi";
import { Badge, Button, Panel } from "@/components/ui";
import { registryAbi } from "@/lib/abi";
import { graphql, type ReviewRow } from "@/lib/graphql";
import { addresses } from "@/lib/ritual";
import { reviewStatuses, statusTone } from "@/lib/status";

type Version = {
  reviewId: string;
  version: number;
  mode: number;
  status: number;
  sourceHash: string;
  sourceURI: string;
  provenanceVerified: boolean;
  score?: number;
  reportHash?: string;
  reportURI?: string;
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    gas: number;
  };
  jobId?: string;
  scheduleId?: string;
  reason?: string;
  createdBlock: number;
  updatedBlock: number;
};

const query = `query Review($id: ID!) {
  review(id: $id) {
    id owner mode status createdBlock updatedBlock versionCount publicShare
    provenanceVerified latestHash latestURI latestScore latestReason
    versions {
      reviewId version mode status sourceHash sourceURI provenanceVerified score
      reportHash reportURI issues { critical high medium low gas }
      jobId scheduleId reason createdBlock updatedBlock
    }
  }
}`;

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const { address } = useAccount();
  const { sendTransactionAsync, isPending } = useSendTransaction();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["review", params.id],
    queryFn: () =>
      graphql<{ review: (ReviewRow & { versions: Version[] }) | null }>(query, {
        id: params.id,
      }),
  });
  const review = data?.review;
  const version = review?.versions?.[0];
  const isOwner =
    address?.toLowerCase() === review?.owner.toLowerCase();

  async function send(
    functionName: "setPublicShare" | "mintCertificate",
    args: readonly [bigint, boolean] | readonly [bigint, number],
  ) {
    const hash = await sendTransactionAsync({
      to: addresses.registry,
      data: encodeFunctionData({
        abi: registryAbi,
        functionName,
        args: args as never,
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await refetch();
    return hash;
  }

  if (isLoading) return <div className="empty">Loading indexed review...</div>;
  if (error || !review)
    return (
      <Panel>
        <div className="empty">
          <FileJson2 size={28} />
          Review #{params.id} is not available from the indexer.
        </div>
      </Panel>
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Review #{review.id}</span>
          <h1>Code review result</h1>
          <p className="mono">{review.owner}</p>
        </div>
        <div className="toolbar">
          <Badge tone={statusTone(review.status)}>
            {reviewStatuses[review.status]}
          </Badge>
          {review.provenanceVerified && (
            <Badge tone="success">Ed25519 verified</Badge>
          )}
        </div>
      </div>

      <div className="content-grid">
        <div className="stack">
          <Panel>
            <div className="panel-header">
              <h2>Latest assessment</h2>
              <Badge tone={review.mode === 0 ? "pending" : "ai"}>
                {review.mode === 0 ? "Fast" : "Deep"} v{review.versionCount}
              </Badge>
            </div>
            <div
              className="panel-body"
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr",
                gap: 24,
                alignItems: "center",
              }}
            >
              <div className="score-ring">{review.latestScore ?? "--"}</div>
              <div>
                <h2>
                  {review.status === 3
                    ? (review.latestScore ?? 0) >= 70
                      ? "Passing baseline"
                      : "Remediation required"
                    : reviewStatuses[review.status]}
                </h2>
                <p style={{ fontSize: 13 }}>
                  Certificate eligibility requires a score of at least 70 and
                  zero critical findings.
                </p>
                {review.latestURI && (
                  <Button asChild variant="secondary">
                    <a
                      href={normalizeStorageUri(review.latestURI)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={15} />
                      Open full report
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="panel-header">
              <h2>Issue summary</h2>
            </div>
            <div className="panel-body issue-grid">
              {(
                [
                  ["Critical", version?.issues.critical ?? 0],
                  ["High", version?.issues.high ?? 0],
                  ["Medium", version?.issues.medium ?? 0],
                  ["Low", version?.issues.low ?? 0],
                  ["Gas", version?.issues.gas ?? 0],
                ] as const
              ).map(([label, value]) => (
                <div className="issue" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="panel-header">
              <h2>Immutable anchors</h2>
            </div>
            <div className="panel-body stack">
              <Anchor label="Source hash" value={version?.sourceHash} />
              <Anchor label="Report hash" value={version?.reportHash} />
              <Anchor
                label={version?.jobId ? "Agent job" : "Schedule"}
                value={version?.jobId || version?.scheduleId}
              />
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel>
            <div className="panel-header">
              <h2>Owner controls</h2>
              <LockKeyhole size={16} className="muted" />
            </div>
            <div className="panel-body stack">
              <Button
                variant="secondary"
                disabled={!isOwner || isPending}
                onClick={() =>
                  void send("setPublicShare", [
                    BigInt(review.id),
                    !review.publicShare,
                  ])
                }
              >
                <Share2 size={15} />
                {review.publicShare ? "Make private" : "Share publicly"}
              </Button>
              <Button
                disabled={
                  !isOwner ||
                  isPending ||
                  review.status !== 3 ||
                  (review.latestScore ?? 0) < 70 ||
                  (version?.issues.critical ?? 1) > 0
                }
                onClick={() =>
                  void send("mintCertificate", [
                    BigInt(review.id),
                    review.versionCount,
                  ])
                }
              >
                <BadgeCheck size={15} />
                Mint certificate
              </Button>
              {!isOwner && (
                <p style={{ fontSize: 12, margin: 0 }}>
                  Connect the review owner wallet to change visibility or mint.
                </p>
              )}
            </div>
          </Panel>
          <Panel>
            <div className="panel-header">
              <h2>Version history</h2>
            </div>
            <div className="panel-body stack">
              {review.versions.map((item) => (
                <div className="check-row" key={item.version}>
                  <span>
                    v{item.version} · {item.mode === 0 ? "Fast" : "Deep"}
                  </span>
                  <Badge tone={statusTone(item.status)}>
                    {item.score ?? reviewStatuses[item.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Anchor({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
        {label}
      </div>
      <div className="code-hash mono">{value || "Not available"}</div>
    </div>
  );
}

function normalizeStorageUri(uri: string) {
  if (!uri.startsWith("hf://")) return uri;
  return `https://huggingface.co/datasets/${uri.slice(5)}`;
}
