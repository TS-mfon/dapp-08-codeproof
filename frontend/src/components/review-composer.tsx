"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  decodeEventLog,
  encodeFunctionData,
  parseEther,
  parseGwei,
  type Hex,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { useExecutors } from "@/hooks/use-executors";
import { registryAbi, trackerAbi } from "@/lib/abi";
import { addresses, isConfigured, ritualChain } from "@/lib/ritual";

const languages = [
  ["auto", "Auto-detect"],
  ["solidity", "Solidity"],
  ["typescript", "TypeScript"],
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["rust", "Rust"],
  ["go", "Go"],
  ["java", "Java"],
  ["csharp", "C#"],
  ["cpp", "C / C++"],
] as const;

type AuditState = "idle" | "wallet" | "sending" | "auditing";

export function ReviewComposer() {
  const [language, setLanguage] = useState("auto");
  const [source, setSource] = useState("");
  const [state, setState] = useState<AuditState>("idle");
  const [error, setError] = useState("");
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { data: executors } = useExecutors();
  const { sendTransactionAsync } = useSendTransaction();

  const { data: fee } = useReadContract({
    address: addresses.registry,
    abi: registryAbi,
    functionName: "fastReviewFee",
    query: { enabled: isConfigured },
  });
  const { data: pendingJob } = useReadContract({
    address: addresses.asyncJobTracker,
    abi: trackerAbi,
    functionName: "hasPendingJobForSender",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const sourceBytes = useMemo(
    () => new TextEncoder().encode(source).byteLength,
    [source],
  );
  const busy = state !== "idle";
  const canAudit =
    isConnected &&
    isConfigured &&
    sourceBytes > 0 &&
    sourceBytes <= 12_000 &&
    Boolean(executors?.llm) &&
    !pendingJob &&
    !busy;

  async function submit() {
    if (!address || !publicClient || !executors?.llm) return;
    setError("");
    try {
      if (chainId !== ritualChain.id) {
        setState("wallet");
        await switchChainAsync({ chainId: ritualChain.id });
      }

      setState("sending");
      const data = encodeFunctionData({
        abi: registryAbi,
        functionName: "requestReview",
        args: [
          source,
          language,
          { publicKey: "0x" as Hex, signature: "0x" as Hex },
          { executor: executors.llm.address, ttl: 300n },
        ],
      });

      const hash = await sendTransactionAsync({
        account: address,
        chainId: ritualChain.id,
        to: addresses.registry,
        data,
        value: (fee ?? parseEther("0.01")) + parseEther("0.02"),
        gas: 6_000_000n,
        type: "eip1559",
        maxFeePerGas: parseGwei("2"),
        maxPriorityFeePerGas: parseGwei("1"),
      });

      setState("auditing");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let reviewId: string | undefined;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== addresses.registry.toLowerCase()) {
          continue;
        }
        try {
          const decoded = decodeEventLog({
            abi: registryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "ReviewRequested") {
            reviewId = String(decoded.args.id);
          }
        } catch {
          // The fulfilled receipt contains several registry events.
        }
      }

      if (!reviewId) throw new Error("The audit completed without a review ID.");
      router.push(`/result/${reviewId}`);
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : "The audit could not be submitted.";
      setError(
        detail.includes("User rejected")
          ? "Transaction cancelled."
          : detail.includes("transaction type not supported")
            ? "Your wallet submitted a legacy transaction. Remove and re-add Ritual Chain, then try again."
            : detail,
      );
      setState("idle");
    }
  }

  const buttonLabel =
    state === "wallet"
      ? "Switching network..."
      : state === "sending"
        ? "Confirm in wallet..."
        : state === "auditing"
          ? "Auditing code..."
          : pendingJob
            ? "Finish pending audit"
            : "Audit code";

  return (
    <section className="audit-editor" aria-label="Code audit editor">
      <div className="editor-toolbar">
        <div className="editor-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <select
          aria-label="Programming language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {languages.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <span className={sourceBytes > 12_000 ? "editor-count error" : "editor-count"}>
          {sourceBytes.toLocaleString()} / 12,000
        </span>
      </div>

      <textarea
        value={source}
        onChange={(event) => setSource(event.target.value)}
        spellCheck={false}
        aria-label="Source code"
        placeholder={`Paste your code here...\n\nfunction example() {\n  // CodeProof will inspect security and correctness.\n}`}
      />

      <div className="editor-footer">
        <p>
          {!isConnected
            ? "Connect a wallet to run an audit."
            : pendingJob
              ? "This wallet already has an audit in progress."
              : "The result is stored on Ritual Chain."}
        </p>
        <button
          className="audit-button"
          type="button"
          onClick={() => void submit()}
          disabled={!canAudit}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <ArrowRight size={17} />
          )}
          {buttonLabel}
        </button>
      </div>

      {error && <div className="audit-error">{error}</div>}
    </section>
  );
}
