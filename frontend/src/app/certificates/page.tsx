"use client";

import React, { useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { REGISTRY_ABI } from "../../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS } from "../../lib/ritual";
import { Award, ShieldCheck, ArrowLeft, Loader2, Search, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function CertificatesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Read nextId from registry to know how many reviews exist
  const { data: nextId, isLoading: nextIdLoading } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "nextId",
  });

  // Calculate review IDs to fetch
  const total = nextId ? Number(nextId) : 0;
  const reviewIds = Array.from({ length: total }, (_, i) => BigInt(i)).reverse();

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="glass p-2.5 rounded-xl hover:bg-white/5 transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-purple-400" />
              Certificate Registry
            </h1>
            <p className="text-sm text-slate-400">
              Browser of TEE-audited secure smart contract deployments.
            </p>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="glass p-4 rounded-2xl max-w-xl flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter by developer address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none text-slate-100 placeholder-slate-500"
        />
      </div>

      {nextIdLoading ? (
        <div className="text-center py-12 space-y-4">
          <Loader2 className="w-12 h-12 text-purple-500 mx-auto animate-spin" />
          <p className="text-slate-400 text-sm">Loading certificate registry...</p>
        </div>
      ) : total === 0 ? (
        <div className="glass p-8 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
          <Award className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Certificates Registered</h3>
          <p className="text-slate-400 text-sm">
            No code reviews have been requested or certificates minted yet. Be the first to secure your contracts!
          </p>
          <Link
            href="/review"
            className="inline-flex items-center bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all cursor-pointer"
          >
            Start First Review
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviewIds.map((id) => (
            <CertificateCard key={id.toString()} reviewId={id} searchFilter={searchTerm} />
          ))}
        </div>
      )}
    </div>
  );
}

// Subcomponent to load and render details for a certificate
function CertificateCard({ reviewId, searchFilter }: { reviewId: bigint; searchFilter: string }) {
  const { data: reviewDetails } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getReview",
    args: [reviewId],
  });

  if (!reviewDetails) return null;

  const [developer, score, certificateMinted, codeHash, reportHash, reportURI, issues] = reviewDetails;

  // Filter out certificates that haven't been minted yet or don't match developer search
  if (!certificateMinted) return null;
  if (searchFilter && !developer.toLowerCase().includes(searchFilter.toLowerCase())) return null;

  return (
    <div className="glass p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300">
      {/* Decorative background glow for passing certificates */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>

      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">Soulbound Verified</span>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Score: {score}/100
          </span>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            Developer: <span className="font-mono text-slate-300">{developer}</span>
          </div>
          <div className="text-xs text-slate-400">
            Code Hash: <span className="font-mono text-slate-300 truncate block max-w-full">{codeHash}</span>
          </div>
        </div>

        {/* Issue counters */}
        <div className="flex items-center gap-4 text-[10px] bg-slate-950/40 p-2.5 rounded-lg border border-white/5 w-fit">
          <span className="text-rose-400">Crit: {issues.critical}</span>
          <span className="text-amber-400">High: {issues.high}</span>
          <span className="text-yellow-400">Med: {issues.medium}</span>
          <span className="text-slate-400">Gas: {issues.gas}</span>
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-white/5 flex justify-between items-center">
        <Link
          href={`/result/${reviewId.toString()}`}
          className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors flex items-center gap-1"
        >
          View Audit Details <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <span className="text-[10px] text-slate-500 font-mono">Token ID #{reviewId.toString()}</span>
      </div>
    </div>
  );
}
