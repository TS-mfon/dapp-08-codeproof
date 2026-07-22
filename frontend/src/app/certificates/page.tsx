"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Badge, Panel } from "@/components/ui";
import { graphql } from "@/lib/graphql";

type Certificate = {
  tokenId: string;
  reviewId: string;
  version: number;
  owner: string;
  reportHash?: string;
  reportURI?: string;
  blockNumber: number;
  txHash: string;
};

export default function CertificatesPage() {
  const { address } = useAccount();
  const { data, isError } = useQuery({
    queryKey: ["certificates", address],
    queryFn: () =>
      graphql<{ certificates: Certificate[] }>(
        `query Certificates($owner: String) {
          certificates(owner: $owner, limit: 100) {
            tokenId reviewId version owner reportHash reportURI blockNumber txHash
          }
        }`,
        { owner: address?.toLowerCase() },
      ),
  });
  const certificates = data?.certificates ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Soulbound credentials</span>
          <h1>CodeProof certificates</h1>
          <p>
            Non-transferable proof that a specific review version met the
            configured score threshold with zero critical findings.
          </p>
        </div>
        <Badge tone={isError ? "danger" : "success"}>
          {isError ? "Indexer offline" : `${certificates.length} issued`}
        </Badge>
      </div>
      {certificates.length ? (
        <div className="grid-2">
          {certificates.map((certificate) => (
            <Panel key={certificate.tokenId}>
              <div className="panel-header">
                <div className="toolbar">
                  <Award size={17} color="var(--green)" />
                  <h2>Certificate #{certificate.tokenId}</h2>
                </div>
                <Badge tone="success">Locked</Badge>
              </div>
              <div className="panel-body stack">
                <div className="check-row">
                  <span>Review</span>
                  <Link href={`/result/${certificate.reviewId}`}>
                    #{certificate.reviewId} · v{certificate.version}
                  </Link>
                </div>
                <div className="check-row">
                  <span>Owner</span>
                  <span className="mono">
                    {certificate.owner.slice(0, 8)}...
                    {certificate.owner.slice(-6)}
                  </span>
                </div>
                <div className="code-hash mono">
                  {certificate.reportHash}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <div className="empty">
            <BadgeCheck size={30} />
            {address
              ? "No certificates indexed for this wallet."
              : "Connect a wallet to filter its certificates."}
          </div>
        </Panel>
      )}
    </>
  );
}
