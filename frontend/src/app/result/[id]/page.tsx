"use client";

import {
  BadgeCheck,
  FileJson2,
  LockKeyhole,
  Share2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { encodeFunctionData } from "viem";
import {
  useAccount,
  useReadContract,
  useSendTransaction,
} from "wagmi";
import { Badge, Button, Panel } from "@/components/ui";
import { registryAbi } from "@/lib/abi";
import { addresses } from "@/lib/ritual";
import { reviewStatuses, statusTone } from "@/lib/status";

type Report = {
  score?: number;
  summary?: string;
  risks?: string[];
};

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const reviewId = BigInt(params.id);
  const { address } = useAccount();
  const { sendTransactionAsync, isPending } = useSendTransaction();
  const reviewQuery = useReadContract({
    address: addresses.registry,
    abi: registryAbi,
    functionName: "getReview",
    args: [reviewId],
  });
  const versionQuery = useReadContract({
    address: addresses.registry,
    abi: registryAbi,
    functionName: "getVersion",
    args: [reviewId, 1],
  });
  const reportQuery = useReadContract({
    address: addresses.registry,
    abi: registryAbi,
    functionName: "getReport",
    args: [reviewId, 1],
    account: address,
    query: { enabled: Boolean(address) },
  });

  const review = reviewQuery.data;
  const version = versionQuery.data;
  const isOwner =
    address?.toLowerCase() === review?.owner.toLowerCase();
  let report: Report | null = null;
  try {
    report = reportQuery.data ? JSON.parse(reportQuery.data) : null;
  } catch {
    report = null;
  }

  async function send(
    functionName: "setPublicShare" | "mintCertificate",
    args: readonly [bigint, boolean] | readonly [bigint, number],
  ) {
    await sendTransactionAsync({
      to: addresses.registry,
      data: encodeFunctionData({
        abi: registryAbi,
        functionName,
        args: args as never,
      }),
    });
    await Promise.all([
      reviewQuery.refetch(),
      versionQuery.refetch(),
      reportQuery.refetch(),
    ]);
  }

  if (reviewQuery.isLoading || versionQuery.isLoading) {
    return <div className="empty">Loading review from Ritual Chain...</div>;
  }
  if (!review || !version || review.owner === addresses.zero) {
    return (
      <Panel>
        <div className="empty">
          <FileJson2 size={28} />
          Review #{params.id} was not found on Ritual Chain.
        </div>
      </Panel>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Review #{params.id}</span>
          <h1>Code audit result</h1>
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
              <Badge tone="ai">Ritual LLM</Badge>
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
              <div className="score-ring">
                {review.status === 3 ? version.score : "--"}
              </div>
              <div>
                <h2>
                  {review.status === 3
                    ? version.score >= 70
                      ? "Passing baseline"
                      : "Remediation required"
                    : reviewStatuses[review.status]}
                </h2>
                <p style={{ fontSize: 13 }}>
                  {report?.summary ||
                    "The structured report is available to the review owner or after public sharing is enabled."}
                </p>
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
                  ["Critical", version.issues.critical],
                  ["High", version.issues.high],
                  ["Medium", version.issues.medium],
                  ["Low", version.issues.low],
                  ["Gas", version.issues.gas],
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
              <h2>Risks and remediation</h2>
            </div>
            <div className="panel-body stack">
              {report?.risks?.length ? (
                report.risks.map((risk) => (
                  <div className="check-row" key={risk}>
                    <span>{risk}</span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Connect the owner wallet to read a private report.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="panel-header">
              <h2>Immutable anchors</h2>
            </div>
            <div className="panel-body stack">
              <Anchor label="Source hash" value={version.sourceHash} />
              <Anchor label="Report hash" value={version.reportHash} />
              <Anchor label="Report URI" value={version.reportURI} />
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
                  void send("setPublicShare", [reviewId, !review.publicShare])
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
                  version.score < 70 ||
                  version.issues.critical > 0 ||
                  version.certificateMinted
                }
                onClick={() => void send("mintCertificate", [reviewId, 1])}
              >
                <BadgeCheck size={15} />
                {version.certificateMinted
                  ? "Certificate minted"
                  : "Mint certificate"}
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Anchor({ label, value }: { label: string; value: string }) {
  return (
    <div className="check-row" style={{ display: "block" }}>
      <span>{label}</span>
      <div className="mono" style={{ marginTop: 7, overflowWrap: "anywhere" }}>
        {value || "--"}
      </div>
    </div>
  );
}
