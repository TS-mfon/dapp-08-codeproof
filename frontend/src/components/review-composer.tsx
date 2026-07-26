"use client";

import { ArrowRight, LoaderCircle, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  encodeFunctionData,
  parseEther,
  parseGwei,
  type Hex,
} from "viem";
import {
  useAccount,
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

const extensionLanguages: Record<string, string> = {
  sol: "solidity",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  cs: "csharp",
  c: "cpp",
  cc: "cpp",
  cpp: "cpp",
  h: "cpp",
  hpp: "cpp",
};

type AuditState = "idle" | "wallet" | "sending" | "auditing";

export function ReviewComposer() {
  const [language, setLanguage] = useState("auto");
  const [source, setSource] = useState("");
  const [state, setState] = useState<AuditState>("idle");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: executors } = useExecutors();
  const { sendTransactionAsync } = useSendTransaction();
  const executorHealth = useQuery({
    queryKey: ["ritual-llm-health"],
    queryFn: async () => {
      const response = await fetch("/api/executor-health", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Executor health check failed.");
      return (await response.json()) as {
        healthy: boolean;
        reason: string;
      };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

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
    executorHealth.data?.healthy === true &&
    !pendingJob &&
    !busy;

  async function loadFile(file?: File) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    setLanguage(extensionLanguages[extension] || "auto");
    setSource(await file.text());
    setError("");
  }

  async function submit() {
    if (!address || !executors?.llm) return;
    setError("");
    try {
      const health = await executorHealth.refetch();
      if (!health.data?.healthy) {
        throw new Error(
          health.data?.reason ||
            "Ritual's LLM executor is temporarily unavailable.",
        );
      }

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
      router.push(`/audit/${hash}`);
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
        <button
          className="upload-button"
          type="button"
          title="Upload code file"
          aria-label="Upload code file"
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} />
        </button>
        <input
          ref={fileInput}
          className="hidden-file-input"
          type="file"
          accept=".sol,.ts,.tsx,.js,.jsx,.py,.rs,.go,.java,.cs,.c,.cc,.cpp,.h,.hpp,.txt"
          onChange={(event) => void loadFile(event.target.files?.[0])}
        />
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
            : executorHealth.data?.healthy === false
              ? "Ritual LLM is temporarily unavailable. No transaction will be submitted."
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
