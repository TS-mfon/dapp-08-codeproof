"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useReadContract, useSendTransaction, usePublicClient } from "wagmi";
import { encodeFunctionData, keccak256, stringToBytes, type Hex } from "viem";
import { REGISTRY_ABI } from "../../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS, SYSTEM_CONTRACTS } from "../../lib/ritual";
import { useAsyncTransaction } from "../../hooks/useAsyncTransaction";
import { useSenderLock } from "../../hooks/useSenderLock";
import { useRitualWallet } from "../../hooks/useRitualWallet";
import { AlertCircle, FileCode, CheckCircle, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RequestReviewPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  // Form Inputs
  const [sourceURI, setSourceURI] = useState("");
  const [codeHash, setCodeHash] = useState("");
  const [executor, setExecutor] = useState("0x862bF47f9644e8562cE0Fe12b4deeC4163c064A8"); // default TEE node
  const [ttl, setTtl] = useState(100);

  // Ritual Hooks
  const { balance, balanceFormatted, deposit, isConfirming: isDepositing, refetchBalance } = useRitualWallet();
  const { isLocked, message: lockMessage, refetch: refetchLock } = useSenderLock();
  const { state, reviewId, error: txError, sendReviewTransaction, reset } = useAsyncTransaction();
  const { sendTransactionAsync } = useSendTransaction();

  // Read fees from contract
  const { data: requestFee } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "requestFee",
  });

  const [depositAmount, setDepositAmount] = useState("0.1");

  // If codeHash is empty, compute hash of sourceURI as placeholder
  const handleAutoHash = () => {
    if (!sourceURI) return;
    const computed = keccak256(stringToBytes(sourceURI));
    setCodeHash(computed);
  };

  const handleDeposit = async () => {
    try {
      await deposit(depositAmount);
      await refetchBalance();
    } catch (e) {
      console.error("Deposit failed", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceURI || !codeHash || !executor || !ttl) return;

    // Prepare bytes32 format for codeHash and address format for executor
    const formattedHash = codeHash.startsWith("0x") ? (codeHash as Hex) : `0x${codeHash}` as Hex;
    const formattedExecutor = executor.startsWith("0x") ? (executor as Hex) : `0x${executor}` as Hex;

    // We MUST bypass simulation using sendTransactionAsync + encodeFunctionData
    const data = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "requestCodeReview",
      args: [formattedHash, sourceURI, formattedExecutor, BigInt(ttl)],
    });

    try {
      await sendReviewTransaction(async () => {
        return await sendTransactionAsync({
          to: DEFAULT_REGISTRY_ADDRESS,
          data,
          // If we want to deposit extra value directly, we can add it to the tx
          value: requestFee ? requestFee : BigInt(0),
          gas: BigInt(2000000), // sufficient gas limit for precompile call
        });
      });
      await refetchLock();
    } catch (err) {
      console.error("Review request failed", err);
    }
  };

  // Automatically redirect on completed review
  useEffect(() => {
    if (state === "SETTLED" && reviewId !== null) {
      router.push(`/result/${reviewId.toString()}`);
    }
  }, [state, reviewId, router]);

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="glass p-8 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Wallet Connection Required</h2>
          <p className="text-slate-400 text-sm">
            Please connect your Web3 wallet to request code reviews on Ritual Chain.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-xl border border-slate-800 transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex items-center gap-4">
        <Link href="/" className="glass p-2.5 rounded-xl hover:bg-white/5 transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            Request Code Review
          </h1>
          <p className="text-sm text-slate-400">
            Submit Solidity source code details to execute a TEE-based AI review.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          {state === "IDLE" || state === "FAILED" ? (
            <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl space-y-6">
              {txError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{txError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Solidity Source URI</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/user/repo/blob/main/contracts/Token.sol"
                    value={sourceURI}
                    onChange={(e) => setSourceURI(e.target.value)}
                    className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleAutoHash}
                    className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Auto-Hash
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Source Content Hash (SHA256/Keccak)</label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={codeHash}
                  onChange={(e) => setCodeHash(e.target.value)}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">TEE Executor Node</label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={executor}
                  onChange={(e) => setExecutor(e.target.value)}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Commitment TTL (blocks)</label>
                <input
                  type="number"
                  required
                  value={ttl}
                  onChange={(e) => setTtl(Number(e.target.value))}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {isLocked ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{lockMessage}</span>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Submit Code Review Request
                </button>
              )}
            </form>
          ) : (
            /* Execution State Indicator */
            <div className="glass p-8 rounded-2xl space-y-6 text-center">
              <Loader2 className="w-12 h-12 text-purple-500 mx-auto animate-spin" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider">{state}</h3>
                <p className="text-sm text-slate-400">
                  {state === "CONFIRMING" && "Approve the transaction in your wallet..."}
                  {state === "SUBMITTED" && "Waiting for Phase 1 block inclusion..."}
                  {state === "COMMITTED" && "Phase 1 committed! Starting TEE off-chain review..."}
                  {state === "EXECUTING" && "AI agent is analyzing Solidity file inside TEE Tdx..."}
                </p>
              </div>

              {state !== "CONFIRMING" && state !== "SUBMITTED" && (
                <div className="w-full bg-slate-950/50 rounded-full h-2 overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full animate-pulse" style={{ width: "60%" }}></div>
                </div>
              )}

              <button
                onClick={reset}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Reset / Try Again
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar info and Wallet stats */}
        <div className="space-y-6">
          {/* Wallet stats */}
          <div className="glass p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Ritual Wallet Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Available Deposit:</span>
                <span className="text-slate-100 font-mono font-semibold">{balanceFormatted} RITUAL</span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-3">
              <label className="text-xs text-slate-400 block">Top up Deposit Balance</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1 text-sm font-mono text-slate-100 focus:outline-none"
                />
                <button
                  onClick={handleDeposit}
                  disabled={isDepositing}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  {isDepositing ? "Funding..." : "Deposit"}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Help */}
          <div className="glass p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-purple-400" />
              Audit Process
            </h3>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>Review fees are paid from the registry and EOA deposits.</li>
              <li>Verification is run inside a hardware-isolated enclave (TEE).</li>
              <li>Calculates structural issues and code quality score.</li>
              <li>Mint passing audits into Soulbound Certificates instantly.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
