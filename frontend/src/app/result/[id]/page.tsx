"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { REGISTRY_ABI } from "../../../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS } from "../../../lib/ritual";
import { ShieldCheck, Award, AlertTriangle, AlertCircle, FileCode, CheckCircle, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function ResultPage() {
  const { id } = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const reviewId = id ? BigInt(id as string) : BigInt(0);

  // Read review details
  const { data: reviewDetails, refetch: refetchReview, isLoading } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getReview",
    args: [reviewId],
  });

  const { data: passingThreshold } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "passingScoreThreshold",
  });

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const handleMintCertificate = async () => {
    setMinting(true);
    setMintError(null);

    try {
      const hash = await writeContractAsync({
        address: DEFAULT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "mintCertificate",
        args: [reviewId],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      await refetchReview();
    } catch (err: any) {
      setMintError(err?.message || "Minting transaction failed.");
    } finally {
      setMinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <Loader2 className="w-12 h-12 text-purple-500 mx-auto animate-spin" />
        <p className="text-slate-400">Loading audit report details...</p>
      </div>
    );
  }

  if (!reviewDetails || reviewDetails[0] === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="glass p-8 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Review Not Found</h2>
          <p className="text-slate-400 text-sm">
            The requested code review ID does not exist or has not been initialized.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-xl border border-slate-800 transition-all text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const [developer, score, certificateMinted, codeHash, reportHash, reportURI, issues] = reviewDetails;
  const isCommitted = score > 0;
  const threshold = passingThreshold !== undefined ? Number(passingThreshold) : 70;
  const isEligible = score >= threshold && issues.critical === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="glass p-2.5 rounded-xl hover:bg-white/5 transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Audit Report #{reviewId.toString()}
            </h1>
            <p className="text-sm text-slate-400">
              Developer: <span className="font-mono text-xs">{developer}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => refetchReview()}
          className="glass p-2.5 rounded-xl hover:bg-white/5 transition-all flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-purple-400" />
          Refresh Report
        </button>
      </div>

      {!isCommitted ? (
        /* Pending Execution State */
        <div className="glass p-8 rounded-2xl text-center space-y-6">
          <Loader2 className="w-12 h-12 text-amber-500 mx-auto animate-spin" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Auditing In Progress</h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Our Sovereign AI agent is reviewing the Solidity codebase inside a Secure TEE. This may take up to 2-3 minutes. You can refresh this page or check back later.
            </p>
          </div>
        </div>
      ) : (
        /* Report Results */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Results Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass p-6 rounded-2xl space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
                <FileCode className="w-5 h-5 text-purple-400" />
                Vulnerability Breakdown
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center">
                  <div className="text-xs text-rose-400 font-semibold uppercase">Critical</div>
                  <div className="text-2xl font-black text-white font-mono mt-1">{issues.critical}</div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center">
                  <div className="text-xs text-amber-400 font-semibold uppercase">High</div>
                  <div className="text-2xl font-black text-white font-mono mt-1">{issues.high}</div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center">
                  <div className="text-xs text-yellow-400 font-semibold uppercase">Medium</div>
                  <div className="text-2xl font-black text-white font-mono mt-1">{issues.medium}</div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-center">
                  <div className="text-xs text-blue-400 font-semibold uppercase">Low</div>
                  <div className="text-2xl font-black text-white font-mono mt-1">{issues.low}</div>
                </div>

                <div className="bg-slate-500/10 border border-slate-500/20 p-4 rounded-xl text-center col-span-2 sm:col-span-1">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Gas</div>
                  <div className="text-2xl font-black text-white font-mono mt-1">{issues.gas}</div>
                </div>
              </div>

              {/* Detailed Report Text Container */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Report details and content verification</h3>
                <div className="p-4 bg-slate-950/50 rounded-xl space-y-2 border border-white/5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-500">Code Hash:</span>
                    <span className="text-slate-300 truncate max-w-[200px] sm:max-w-none">{codeHash}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-500">Report Hash:</span>
                    <span className="text-slate-300 truncate max-w-[200px] sm:max-w-none">{reportHash}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-500">Report URI:</span>
                    <span className="text-slate-300 truncate max-w-[200px] sm:max-w-none">{reportURI}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Score Gauge and Mint Controls */}
          <div className="space-y-6">
            {/* Score card */}
            <div className="glass p-6 rounded-2xl text-center space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Overall Score</h3>
              <div className="relative inline-flex items-center justify-center">
                {/* SVG Radial Progress */}
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    stroke={score >= threshold ? "#10b981" : "#ef4444"}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={339.292}
                    strokeDashoffset={339.292 - (339.292 * Number(score)) / 100}
                  />
                </svg>
                <div className="absolute text-3xl font-black text-white font-mono">{score}/100</div>
              </div>

              <div className="text-xs text-slate-400">
                {score >= threshold ? (
                  <span className="text-emerald-400 font-semibold flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Passing Score
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold flex items-center justify-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Score under threshold ({threshold})
                  </span>
                )}
              </div>
            </div>

            {/* Certificate Mint Controls */}
            <div className="glass p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-purple-400" />
                Sovereign Certificate
              </h3>

              {certificateMinted ? (
                <div className="space-y-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Certificate Minted</h4>
                    <p className="text-xs text-emerald-400/80">
                      This smart contract codebase is verified and recorded on-chain.
                    </p>
                  </div>
                  <Link
                    href="/certificates"
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 hover:text-white font-semibold py-2.5 px-4 rounded-xl text-center text-xs block transition-all cursor-pointer"
                  >
                    View in Registry
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Smart contracts with a score above <strong>{threshold}</strong> and <strong>0 critical issues</strong> qualify for a non-transferable Soulbound NFT Certificate.
                  </p>
                  {isEligible ? (
                    <div>
                      {isConnected && developer.toLowerCase() === address?.toLowerCase() ? (
                        <div className="space-y-3">
                          {mintError && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] break-words">
                              {mintError}
                            </div>
                          )}
                          <button
                            onClick={handleMintCertificate}
                            disabled={minting}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                          >
                            {minting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Minting...
                              </>
                            ) : (
                              "Mint Soulbound NFT"
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs text-center font-medium">
                          Only the developer can mint this certificate.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center font-medium">
                      Not eligible for certificate.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
