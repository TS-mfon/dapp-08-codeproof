"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Blocks,
  FileCode2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ReviewTable } from "@/components/review-table";
import { Badge, Button, Panel } from "@/components/ui";
import { graphql, reviewFields, type ReviewRow } from "@/lib/graphql";
import { isConfigured } from "@/lib/ritual";

const query = `query Dashboard {
  reviews(publicOnly: true, limit: 20) { ${reviewFields} }
  certificates(limit: 100) { tokenId }
  indexerStatus { blockNumber blockHash }
}`;

export default function Dashboard() {
  const { data, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () =>
      graphql<{
        reviews: ReviewRow[];
        certificates: { tokenId: string }[];
        indexerStatus: { blockNumber?: number };
      }>(query),
  });
  const reviews = data?.reviews ?? [];
  const completed = reviews.filter((review) => review.status === 3);
  const avgScore = completed.length
    ? Math.round(
        completed.reduce((sum, item) => sum + (item.latestScore ?? 0), 0) /
          completed.length,
      )
    : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">On-chain security intelligence</span>
          <h1>Review operations</h1>
          <p>
            Paste code in any supported language, audit it with Ritual LLM,
            inspect immutable report anchors, and issue soulbound proof for
            passing builds.
          </p>
        </div>
        <Button asChild>
          <Link href="/review">
            <Plus size={16} />
            New review
          </Link>
        </Button>
      </div>

      {!isConfigured && (
        <div className="notice" style={{ marginBottom: 14 }}>
          Contract addresses are not configured. Set
          {" "}<span className="mono">NEXT_PUBLIC_REGISTRY_ADDRESS</span> after
          deployment to enable writes.
        </div>
      )}

      <div className="grid-4">
        <Panel className="stat">
          <div className="stat-label">
            Public reviews <FileCode2 size={16} />
          </div>
          <strong>{reviews.length}</strong>
          <small>Confirmed indexer records</small>
        </Panel>
        <Panel className="stat">
          <div className="stat-label">
            Completed <ShieldCheck size={16} />
          </div>
          <strong>{completed.length}</strong>
          <small>Committed on-chain</small>
        </Panel>
        <Panel className="stat">
          <div className="stat-label">
            Average score <Blocks size={16} />
          </div>
          <strong>{avgScore || "--"}</strong>
          <small>Across completed reviews</small>
        </Panel>
        <Panel className="stat">
          <div className="stat-label">
            Certificates <BadgeCheck size={16} />
          </div>
          <strong>{data?.certificates.length ?? 0}</strong>
          <small>Non-transferable credentials</small>
        </Panel>
      </div>

      <div className="content-grid">
        <Panel>
          <div className="panel-header">
            <h2>Public review feed</h2>
            <Badge tone={isError ? "danger" : "success"}>
              {isError ? "Indexer offline" : "Confirmed"}
            </Badge>
          </div>
          <ReviewTable reviews={reviews} />
        </Panel>
        <div className="stack">
          <Panel>
            <div className="panel-header">
              <h2>Network state</h2>
            </div>
            <div className="panel-body preflight">
              <div className="check-row">
                <span>Chain</span>
                <Badge tone="success">Ritual 1979</Badge>
              </div>
              <div className="check-row">
                <span>Confirmed block</span>
                <span className="mono">
                  {data?.indexerStatus.blockNumber ?? "--"}
                </span>
              </div>
              <div className="check-row">
                <span>Data authority</span>
                <span>Ritual contract state</span>
              </div>
              <div className="check-row">
                <span>Certificate</span>
                <span>ERC-5192</span>
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="panel-body">
              <Badge tone="ai">Ritual LLM</Badge>
              <h2 style={{ marginTop: 14 }}>Direct code audit</h2>
              <p style={{ fontSize: 13, marginBottom: 0 }}>
                Code is sent directly to Ritual LLM for structured security
                analysis, with source and report hashes committed on-chain.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
