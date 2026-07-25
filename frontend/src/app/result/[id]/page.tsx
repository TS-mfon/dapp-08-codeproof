"use client";

import { ArrowLeft, FileJson2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { registryAbi } from "@/lib/abi";
import { addresses } from "@/lib/ritual";
import { reviewStatuses } from "@/lib/status";

type Report = {
  summary?: string;
  risks?: string[];
};

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const reviewId = BigInt(params.id);
  const { address } = useAccount();
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
  let report: Report | null = null;
  try {
    report = reportQuery.data ? JSON.parse(reportQuery.data) : null;
  } catch {
    report = null;
  }

  if (reviewQuery.isLoading || versionQuery.isLoading) {
    return (
      <div className="result-state">
        <LoaderCircle className="spin" />
        Loading audit...
      </div>
    );
  }

  if (!review || !version || review.owner === addresses.zero) {
    return (
      <div className="result-state">
        <FileJson2 />
        Audit #{params.id} was not found.
      </div>
    );
  }

  const completed = review.status === 3;
  const issues = [
    ["Critical", version.issues.critical],
    ["High", version.issues.high],
    ["Medium", version.issues.medium],
    ["Low", version.issues.low],
    ["Gas", version.issues.gas],
  ] as const;

  return (
    <section className="audit-result">
      <div className="result-heading">
        <div>
          <span className="eyebrow">Audit #{params.id}</span>
          <h1>{completed ? "Your code review" : reviewStatuses[review.status]}</h1>
        </div>
        <Link className="back-button" href="/">
          <ArrowLeft size={15} />
          New audit
        </Link>
      </div>

      <div className="result-summary">
        <div className="result-score">
          <strong>{completed ? version.score : "--"}</strong>
          <span>Security score</span>
        </div>
        <div>
          <h2>
            {completed
              ? version.score >= 70
                ? "Good foundation, review the findings."
                : "Remediation is recommended."
              : "Ritual LLM is processing the audit."}
          </h2>
          <p>
            {report?.summary ||
              "Keep this wallet connected to read the completed private audit."}
          </p>
        </div>
      </div>

      <div className="result-issues">
        {issues.map(([label, count]) => (
          <div key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <section className="result-findings">
        <h2>Findings</h2>
        {report?.risks?.length ? (
          <ol>
            {report.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ol>
        ) : (
          <p>
            {completed
              ? "Connect the wallet that requested this audit to view its findings."
              : "Findings will appear when the Ritual LLM transaction settles."}
          </p>
        )}
      </section>
    </section>
  );
}
