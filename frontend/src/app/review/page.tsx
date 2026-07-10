"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useReadContract, useSendTransaction, useSwitchChain } from "wagmi";
import { encodeFunctionData, keccak256, stringToBytes, type Hex, parseEther } from "viem";
import { REGISTRY_ABI } from "../../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS } from "../../lib/ritual";
import { useAsyncTransaction } from "../../hooks/useAsyncTransaction";
import { AlertCircle, ArrowLeft, Loader2, Sparkles, Code, FileCode } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RequestReviewPage() {
  const { isConnected, address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const router = useRouter();

  // Mode: "github" | "paste"
  const [inputMode, setInputMode] = useState<"github" | "paste">("github");

  // Inputs
  const [sourceURI, setSourceURI] = useState("");
  const [pastedCode, setPastedCode] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  // Ritual hooks
  const { state, reviewId, error: txError, sendReviewTransaction, reset } = useAsyncTransaction();
  const { sendTransactionAsync } = useSendTransaction();

  // Read requestFee from contract (should be 0.01 RITUAL)
  const { data: requestFee } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "requestFee",
  });

  // Read active TEE executor dynamically from registry
  const { data: dynamicExecutor } = useReadContract({
    address: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
    abi: [
      {
        name: "getIndexedServiceByCapabilityAt",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "capability", type: "uint8" },
          { name: "index", type: "uint256" },
        ],
        outputs: [{ type: "address" }],
      },
    ] as const,
    functionName: "getIndexedServiceByCapabilityAt",
    args: [0, BigInt(0)],
  });

  // Auto switch chain to Ritual Chain (ID 1979)
  useEffect(() => {
    if (isConnected && chain?.id !== 1979) {
      try {
        switchChain({ chainId: 1979 });
      } catch (e) {
        console.error("Chain switch failed", e);
      }
    }
  }, [isConnected, chain?.id, switchChain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (chain?.id !== 1979) {
      setFormError("Please switch your wallet to the Ritual network before submitting.");
      return;
    }

    let finalSourceURI = "";
    let finalCodeHash = "";

    if (inputMode === "github") {
      if (!sourceURI.trim()) {
        setFormError("Please enter a valid GitHub Solidity contract link.");
        return;
      }
      finalSourceURI = sourceURI.trim();
      finalCodeHash = keccak256(stringToBytes(finalSourceURI));
    } else {
      if (!pastedCode.trim()) {
        setFormError("Please paste your Solidity contract code.");
        return;
      }
      finalSourceURI = `pasted://solidity-${Date.now()}`;
      finalCodeHash = keccak256(stringToBytes(pastedCode));
    }

    // Default TEE Executor and TTL
    const defaultExecutor = (dynamicExecutor || "0x20808e03EFa33E16ac7d5138a026c9c56448D3EC") as Hex;
    const defaultTtl = 100;

    // We must bypass simulation by using encodeFunctionData + sendTransactionAsync
    const data = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "requestCodeReview",
      args: [finalCodeHash as Hex, finalSourceURI, defaultExecutor, BigInt(defaultTtl)],
    });

    // Total fee is 0.02 RITUAL: 0.01 treasury fee + 0.01 auto-deposit TEE budget
    const treasuryFee = requestFee ? requestFee : parseEther("0.01");
    const totalTxValue = treasuryFee + parseEther("0.01");

    try {
      await sendReviewTransaction(async () => {
        return await sendTransactionAsync({
          to: DEFAULT_REGISTRY_ADDRESS,
          data,
          value: totalTxValue,
          gas: BigInt(2000000), // sufficient gas limit for precompile TEE call
        });
      });
    } catch (err: any) {
      console.error("Review request transaction error", err);
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

  const isWrongChain = chain?.id !== 1979;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex items-center gap-4">
        <Link href="/" className="glass p-2.5 rounded-xl hover:bg-white/5 transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
            AI Smart Contract Auditor
          </h1>
          <p className="text-sm text-slate-400">
            Submit a Solidity contract GitHub link or paste the code directly for a TEE-secured AI review.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {state === "IDLE" || state === "FAILED" ? (
          <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl space-y-6">
            {/* Error notifications */}
            {(formError || txError) && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError || txError}</span>
              </div>
            )}

            {/* Input Mode Selector */}
            <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setInputMode("github");
                  setFormError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  inputMode === "github"
                    ? "bg-purple-600/90 text-white shadow-lg shadow-purple-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                GitHub Link
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode("paste");
                  setFormError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  inputMode === "paste"
                    ? "bg-purple-600/90 text-white shadow-lg shadow-purple-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Paste Code
              </button>
            </div>

            {/* Form Inputs based on mode */}
            {inputMode === "github" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">GitHub Solidity File URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/username/repo/blob/main/contracts/MyContract.sol"
                  value={sourceURI}
                  onChange={(e) => setSourceURI(e.target.value)}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Solidity Source Code</label>
                <div className="relative rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 focus-within:border-purple-500/50 transition-all duration-300">
                  {/* IDE-like Header */}
                  <div className="bg-slate-900/80 px-4 py-2 border-b border-white/5 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                    <span className="text-[10px] font-mono text-slate-500 ml-2">MyContract.sol</span>
                  </div>
                  {/* Textarea */}
                  <textarea
                    rows={12}
                    placeholder={`// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract MyContract {\n    // Paste solidity contract code here...\n}`}
                    value={pastedCode}
                    onChange={(e) => setPastedCode(e.target.value)}
                    className="w-full bg-transparent p-4 text-xs font-mono text-slate-300 focus:outline-none resize-y min-h-[250px]"
                  />
                </div>
              </div>
            )}

            {/* Fee Breakdown details */}
            <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Registry Audit Fee (Treasury):</span>
                <span className="font-mono text-slate-200">0.01 RITUAL</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>TEE Computation Fee (TEE Budget):</span>
                <span className="font-mono text-slate-200">0.01 RITUAL</span>
              </div>
              <div className="border-t border-white/5 pt-2 flex justify-between font-bold text-slate-200">
                <span>Total Transaction Fee:</span>
                <span className="font-mono text-purple-400">0.02 RITUAL</span>
              </div>
            </div>

            {/* Submit Button */}
            {isWrongChain ? (
              <button
                type="button"
                onClick={() => switchChain({ chainId: 1979 })}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all duration-300 cursor-pointer text-sm"
              >
                Switch Wallet to Ritual Chain to Submit
              </button>
            ) : (
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-sm"
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
                {state === "CONFIRMING" && "Approve the audit transaction in your wallet..."}
                {state === "SUBMITTED" && "Waiting for transaction block inclusion..."}
                {state === "COMMITTED" && "Transaction confirmed! Starting TEE off-chain review..."}
                {state === "EXECUTING" && "Ritual AI Auditor is evaluating code inside secure TEE..."}
              </p>
            </div>

            {state !== "CONFIRMING" && state !== "SUBMITTED" && (
              <div className="w-full bg-slate-950/50 rounded-full h-2 overflow-hidden max-w-md mx-auto">
                <div className="bg-purple-500 h-full rounded-full animate-pulse" style={{ width: "70%" }}></div>
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
    </div>
  );
}
