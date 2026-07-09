"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient, useBlockNumber } from "wagmi";
import { REGISTRY_ABI } from "../../lib/abi";
import { DEFAULT_REGISTRY_ADDRESS, SYSTEM_CONTRACTS } from "../../lib/ritual";
import { Settings, ShieldAlert, Award, ArrowLeft, Loader2, CheckCircle, RefreshCw, Landmark, Unlock, Lock } from "lucide-react";
import Link from "next/link";
import { parseEther, formatEther } from "viem";

const WALLET_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "lockUntil",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

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

  // Read RitualWallet Escrow balance for connected user
  const { data: escrowBalance, refetch: refetchEscrow } = useReadContract({
    address: SYSTEM_CONTRACTS.RITUAL_WALLET,
    abi: WALLET_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: lockExpiry, refetch: refetchLock } = useReadContract({
    address: SYSTEM_CONTRACTS.RITUAL_WALLET,
    abi: WALLET_ABI,
    functionName: "lockUntil",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: blockNumber } = useBlockNumber();

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

  const handleWithdrawEscrow = async () => {
    if (!escrowBalance || escrowBalance === BigInt(0)) return;
    setUpdating(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const hash = await writeContractAsync({
        address: SYSTEM_CONTRACTS.RITUAL_WALLET,
        abi: WALLET_ABI,
        functionName: "withdraw",
        args: [escrowBalance],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchEscrow();
      await refetchLock();
      setSuccessMsg(`Successfully withdrew ${formatEther(escrowBalance)} RITUAL from TEE Escrow!`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to withdraw escrow funds");
    } finally {
      setUpdating(false);
    }
  };

  const isLocked = lockExpiry && blockNumber ? BigInt(blockNumber) < BigInt(lockExpiry) : false;

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
            Control Center & Escrow
          </h1>
          <p className="text-sm text-slate-400">
            Configure system parameters or manage/withdraw your time-locked TEE escrow deposits.
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
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl space-y-6 h-fit">
            <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Registry Info</h2>
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

          {/* TEE Escrow Card */}
          {isConnected && (
            <div className="glass p-6 rounded-2xl space-y-6 h-fit border border-purple-500/10">
              <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3 flex items-center gap-1.5">
                <Landmark className="w-5 h-5 text-purple-400" />
                TEE Escrow Wallet
              </h2>
              <div className="space-y-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Escrow Balance:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {escrowBalance !== undefined ? `${formatEther(escrowBalance)} RITUAL` : "--"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lock Expiry Block:</span>
                  <span className="font-mono text-slate-200">
                    {lockExpiry !== undefined ? lockExpiry.toString() : "--"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Block:</span>
                  <span className="font-mono text-slate-200">
                    {blockNumber !== undefined ? blockNumber.toString() : "--"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-3">
                  <span className="text-slate-400">Escrow Status:</span>
                  {isLocked ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Locked
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Unlock className="w-3.5 h-3.5" /> Unlocked
                    </span>
                  )}
                </div>

                <button
                  onClick={handleWithdrawEscrow}
                  disabled={updating || !escrowBalance || escrowBalance === BigInt(0) || isLocked}
                  className={`w-full py-2.5 px-4 rounded-xl text-center text-xs font-semibold block transition-all cursor-pointer ${
                    !escrowBalance || escrowBalance === BigInt(0) || isLocked
                      ? "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/10 transform hover:-translate-y-0.5"
                  }`}
                >
                  Withdraw Escrow Balance
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Forms */}
        <div className="md:col-span-2 space-y-6">
          {!isConnected ? (
            <div className="glass p-8 rounded-2xl text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto" />
              <h3 className="text-lg font-bold text-white">Wallet Connection Required</h3>
              <p className="text-slate-400 text-sm">
                Connect your wallet to manage registry settings and TEE escrow balances.
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
                      placeholder="e.g. 0.01"
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
                      placeholder="e.g. 70"
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
