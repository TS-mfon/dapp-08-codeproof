"use client";

import React, { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { REGISTRY_ABI } from "../../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS } from "../../lib/ritual";
import { Settings, ShieldAlert, Award, ArrowLeft, Loader2, CheckCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { parseEther, formatEther } from "viem";

export default function AdminPage() {
  const { isConnected, address } = useAccount();
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Inputs
  const [newFee, setNewFee] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  const [newCertContract, setNewCertContract] = useState("");

  // Read current registry configuration
  const { data: requestFee, refetch: refetchFee } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "requestFee",
  });

  const { data: threshold, refetch: refetchThreshold } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "passingScoreThreshold",
  });

  const { data: certContract, refetch: refetchCert } = useReadContract({
    address: DEFAULT_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "certificateContract",
  });

  // Write functions
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const handleUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFee) return;
    setUpdating(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const hash = await writeContractAsync({
        address: DEFAULT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setRequestFee",
        args: [parseEther(newFee)],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchFee();
      setSuccessMsg("Spam prevention fee updated successfully!");
      setNewFee("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update fee");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreshold) return;
    setUpdating(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const hash = await writeContractAsync({
        address: DEFAULT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setPassingScoreThreshold",
        args: [Number(newThreshold)],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchThreshold();
      setSuccessMsg("Passing threshold score updated successfully!");
      setNewThreshold("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update threshold");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateCertContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCertContract) return;
    setUpdating(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const hash = await writeContractAsync({
        address: DEFAULT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setCertificateContract",
        args: [newCertContract as `0x${string}`],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchCert();
      setSuccessMsg("Certificate NFT contract updated successfully!");
      setNewCertContract("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update certificate contract");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex items-center gap-4">
        <Link href="/" className="glass p-2.5 rounded-xl hover:bg-white/5 transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-400" />
            Registry Administration
          </h1>
          <p className="text-sm text-slate-400">
            Configure system fees, thresholds, and contract connections.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Current Config panel */}
        <div className="glass p-6 rounded-2xl space-y-6 h-fit">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Current Parameters</h2>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Spam Prevention Fee</div>
              <div className="text-lg font-mono font-bold text-white mt-1">
                {requestFee !== undefined ? `${formatEther(requestFee)} RITUAL` : "--"}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Passing Score Threshold</div>
              <div className="text-lg font-mono font-bold text-white mt-1">
                {threshold !== undefined ? `${threshold.toString()}/100` : "--"}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Certificate NFT Address</div>
              <div className="text-xs font-mono font-bold text-purple-400 truncate mt-1">
                {certContract !== undefined ? certContract : "--"}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Forms */}
        <div className="md:col-span-2 space-y-6">
          {!isConnected ? (
            <div className="glass p-8 rounded-2xl text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto" />
              <h3 className="text-lg font-bold text-white">Wallet Connection Required</h3>
              <p className="text-slate-400 text-sm">
                Connect the registry owner wallet to update parameters.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Fee Update Form */}
              <form onSubmit={handleUpdateFee} className="glass p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Update Spam Prevention Fee</h3>
                <div className="flex gap-4 items-end">
                  <div className="w-full space-y-2">
                    <input
                      type="number"
                      step="0.001"
                      required
                      placeholder="e.g. 0.05"
                      value={newFee}
                      onChange={(e) => setNewFee(e.target.value)}
                      className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updating}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Update Fee
                  </button>
                </div>
              </form>

              {/* Threshold Update Form */}
              <form onSubmit={handleUpdateThreshold} className="glass p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Update Passing Score Threshold</h3>
                <div className="flex gap-4 items-end">
                  <div className="w-full space-y-2">
                    <input
                      type="number"
                      required
                      placeholder="e.g. 75"
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(e.target.value)}
                      className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updating}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Update Threshold
                  </button>
                </div>
              </form>

              {/* Cert Address Update Form */}
              <form onSubmit={handleUpdateCertContract} className="glass p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Update Certificate NFT Address</h3>
                <div className="flex gap-4 items-end">
                  <div className="w-full space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="0x..."
                      value={newCertContract}
                      onChange={(e) => setNewCertContract(e.target.value)}
                      className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updating}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Set Contract
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
