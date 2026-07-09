"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { REGISTRY_ABI } from "../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS } from "../lib/ritual";
import { ShieldCheck, Plus, Award, AlertCircle, FileCode } from "lucide-react";
import { formatEther } from "viem";

export default function Home() {
  const { address, isConnected } = useAccount();

  // Read registry global states
  const { data: requestFee } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "requestFee",
  });

  const { data: passingScore } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "passingScoreThreshold",
  });

  const { data: totalReviews } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "nextId",
  });

  // Read connected user's reviews
  const { data: userReviewIds } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getDeveloperReviews",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12 max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-400 text-transparent bg-clip-text">
          On-Chain Code Review & <br />
          <span className="bg-gradient-to-r from-purple-400 to-cyan-400 text-transparent bg-clip-text">
            Soulbound NFT Certificates
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Secure your smart contracts using TEE-verified AI code reviews. Submit Solidity source code hashes, run reviews on Ritual, and mint non-transferable Soulbound Certificates.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link
            href="/review"
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Request New Review
          </Link>
          <Link
            href="/certificates"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold py-3 px-6 rounded-xl transition-all cursor-pointer"
          >
            <Award className="w-5 h-5 text-purple-400" />
            View Certificate Registry
          </Link>
        </div>
      </section>

      {/* Network Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>
          <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Reviews</div>
          <div className="text-4xl font-extrabold text-white font-mono">
            {totalReviews !== undefined ? totalReviews.toString() : "--"}
          </div>
        </div>

        <div className="glass p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl"></div>
          <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Registry Fee</div>
          <div className="text-4xl font-extrabold text-white font-mono">
            {requestFee !== undefined ? `${formatEther(requestFee)} RITUAL` : "--"}
          </div>
        </div>

        <div className="glass p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
          <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Passing Threshold</div>
          <div className="text-4xl font-extrabold text-white font-mono">
            {passingScore !== undefined ? `${passingScore.toString()}/100` : "--"}
          </div>
        </div>
      </section>

      {/* User Reviews Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            Your Code Reviews
          </h2>
          {isConnected && userReviewIds && userReviewIds.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
              {userReviewIds.length} review(s)
            </span>
          )}
        </div>

        {!isConnected ? (
          <div className="glass p-8 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">Wallet Disconnected</h3>
            <p className="text-slate-400 text-sm">
              Connect your wallet to see recent audits, request new code reviews, and mint Soulbound Certificates.
            </p>
          </div>
        ) : !userReviewIds || userReviewIds.length === 0 ? (
          <div className="glass p-8 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
            <FileCode className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Reviews Found</h3>
            <p className="text-slate-400 text-sm">
              You haven't requested any code reviews yet. Start your first code review to secure your smart contracts.
            </p>
            <Link
              href="/review"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all"
            >
              Start Review
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...userReviewIds].reverse().map((id) => (
              <ReviewCard key={id.toString()} reviewId={id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Subcomponent to load and render individual review details
function ReviewCard({ reviewId }: { reviewId: bigint }) {
  const { data: reviewDetails } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getReview",
    args: [reviewId],
  });

  if (!reviewDetails) {
    return (
      <div className="glass p-6 rounded-2xl animate-pulse h-36"></div>
    );
  }

  const [developer, score, certificateMinted, codeHash, reportHash, reportURI, issues] = reviewDetails;
  const isCommitted = score > 0;

  return (
    <div className="glass p-6 rounded-2xl flex flex-col justify-between h-full border border-white/5 hover:border-purple-500/30 transition-all duration-300">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <span className="text-xs font-mono text-slate-500">Review #{reviewId.toString()}</span>
          {isCommitted ? (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              score >= 70 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}>
              Score: {score}/100
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
              Auditing...
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-200 truncate">
            Code Hash: <span className="font-mono text-xs text-slate-400">{codeHash}</span>
          </div>
          {isCommitted && (
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-2">
              <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded">Crit: {issues.critical}</span>
              <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded">High: {issues.high}</span>
              <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">Med: {issues.medium}</span>
              <span className="bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded">Gas: {issues.gas}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 mt-auto flex justify-between items-center border-t border-white/5">
        <Link
          href={`/result/${reviewId.toString()}`}
          className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
        >
          View Details &rarr;
        </Link>
        {certificateMinted && (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
            <Award className="w-4 h-4" />
            SB NFT Minted
          </span>
        )}
      </div>
    </div>
  );
}
