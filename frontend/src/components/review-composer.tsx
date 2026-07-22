"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  FileCode2,
  KeyRound,
  LoaderCircle,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  parseEther,
  type Hex,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSendTransaction,
} from "wagmi";
import { useExecutors } from "@/hooks/use-executors";
import { registryAbi, ritualWalletAbi, trackerAbi } from "@/lib/abi";
import { pendingDb } from "@/lib/pending";
import { addresses, isConfigured } from "@/lib/ritual";
import type { LifecycleStatus } from "@/lib/status";
import { AsyncTimeline } from "./async-timeline";
import { Badge, Button, Field, Panel } from "./ui";

const languages = [
  ["auto", "Auto-detect", "txt"],
  ["solidity", "Solidity", "sol"],
  ["typescript", "TypeScript", "ts"],
  ["javascript", "JavaScript", "js"],
  ["python", "Python", "py"],
  ["rust", "Rust", "rs"],
  ["go", "Go", "go"],
  ["java", "Java", "java"],
  ["csharp", "C#", "cs"],
  ["cpp", "C / C++", "cpp"],
] as const;

const zeroBytes = "0x" as Hex;
const formatAddress = (value?: string) =>
  value ? `${value.slice(0, 7)}...${value.slice(-5)}` : "Unavailable";

export function ReviewComposer() {
  const [language, setLanguage] = useState("auto");
  const [source, setSource] = useState("");
  const [filename, setFilename] = useState("source.txt");
  const [publicKey, setPublicKey] = useState("");
  const [signature, setSignature] = useState("");
  const [executionBudget, setExecutionBudget] = useState("0.02");
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  const [message, setMessage] = useState("");
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: executors, isLoading: loadingExecutors } = useExecutors();
  const { sendTransactionAsync } = useSendTransaction();
  const recent = useLiveQuery(
    () =>
      address
        ? pendingDb.reviews
            .where("account")
            .equals(address.toLowerCase())
            .reverse()
            .sortBy("createdAt")
        : [],
    [address],
  );

  const { data: pendingJob } = useReadContract({
    address: addresses.asyncJobTracker,
    abi: trackerAbi,
    functionName: "hasPendingJobForSender",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: preflight } = useReadContracts({
    contracts: address
      ? [
          {
            address: addresses.ritualWallet,
            abi: ritualWalletAbi,
            functionName: "balanceOf",
            args: [addresses.registry],
          },
          {
            address: addresses.ritualWallet,
            abi: ritualWalletAbi,
            functionName: "lockUntil",
            args: [addresses.registry],
          },
          {
            address: addresses.registry,
            abi: registryAbi,
            functionName: "fastReviewFee",
          },
        ]
      : [],
    query: { enabled: Boolean(address && isConfigured) },
  });

  const sourceBytes = useMemo(
    () => new TextEncoder().encode(source).byteLength,
    [source],
  );
  const fee = (preflight?.[2]?.result as bigint | undefined) ?? 0n;
  const walletBalance = (preflight?.[0]?.result as bigint | undefined) ?? 0n;
  const lockUntil = (preflight?.[1]?.result as bigint | undefined) ?? 0n;
  const provenanceValid =
    (!publicKey && !signature) ||
    (/^0x[0-9a-fA-F]{64}$/.test(publicKey) &&
      /^0x[0-9a-fA-F]{128}$/.test(signature));
  const canSubmit =
    isConfigured &&
    isConnected &&
    sourceBytes > 0 &&
    sourceBytes <= 12_000 &&
    provenanceValid &&
    !pendingJob &&
    Boolean(executors?.llm) &&
    !status;

  async function handleFile(file?: File) {
    if (!file) return;
    setFilename(file.name);
    const extension = file.name.split(".").pop()?.toLowerCase();
    const match = languages.find((item) => item[2] === extension);
    if (match) setLanguage(match[0]);
    setSource(await file.text());
  }

  function changeLanguage(value: string) {
    setLanguage(value);
    const extension =
      languages.find((item) => item[0] === value)?.[2] ?? "txt";
    if (!source || filename.startsWith("source.")) {
      setFilename(`source.${extension}`);
    }
  }

  async function setPending(
    txHash: string,
    nextStatus: LifecycleStatus,
    error?: string,
    reviewId?: string,
  ) {
    if (!address) return;
    await pendingDb.reviews.put({
      txHash,
      account: address.toLowerCase(),
      mode: "FAST",
      status: nextStatus,
      createdAt: Date.now(),
      reviewId,
      error,
    });
    setStatus(nextStatus);
  }

  async function submit() {
    if (!address || !publicClient || !executors?.llm) return;
    setMessage("");
    setStatus("SUBMITTING");
    let txHash = "";
    try {
      const data = encodeFunctionData({
        abi: registryAbi,
        functionName: "requestReview",
        args: [
          source,
          language,
          {
            publicKey: (publicKey || zeroBytes) as Hex,
            signature: (signature || zeroBytes) as Hex,
          },
          { executor: executors.llm.address, ttl: 300n },
        ],
      });
      const hash = await sendTransactionAsync({
        to: addresses.registry,
        data,
        value: fee + parseEther(executionBudget || "0"),
        gas: 6_000_000n,
      });
      txHash = hash;
      await setPending(hash, "PENDING_COMMITMENT");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let reviewId: string | undefined;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== addresses.registry.toLowerCase())
          continue;
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
          // Fulfilled async receipts contain several registry events.
        }
      }
      await setPending(hash, "SETTLED", undefined, reviewId);
      setMessage(
        reviewId
          ? `Review #${reviewId} completed on Ritual.`
          : "Review completed on Ritual.",
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Transaction failed";
      if (txHash) await setPending(txHash, "FAILED", detail);
      else setStatus(null);
      setMessage(detail);
    }
  }

  return (
    <div className="composer-grid">
      <div className="stack">
        <Panel>
          <div className="panel-header">
            <h2>Ritual LLM audit</h2>
            <Badge tone="ai">Multi-language</Badge>
          </div>
          <div className="panel-body stack">
            <p style={{ fontSize: 13, margin: 0 }}>
              Paste one source file or load it locally. CodeProof sends the
              source directly to Ritual LLM and anchors the structured result
              on Ritual Chain.
            </p>
          </div>
        </Panel>

        <Panel>
          <div className="panel-header">
            <h2>Source code</h2>
            <span className="mono muted" style={{ fontSize: 11 }}>
              {sourceBytes.toLocaleString()} / 12,000 bytes
            </span>
          </div>
          <div className="panel-body stack">
            <Field label="Programming language">
              <select
                className="input"
                value={language}
                onChange={(event) => changeLanguage(event.target.value)}
              >
                {languages.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="file-drop">
              <FileCode2 />
              <span>
                <strong style={{ color: "var(--text)", display: "block" }}>
                  {filename}
                </strong>
                Select a local source file or paste the content below
              </span>
              <Upload size={17} style={{ marginLeft: "auto" }} />
              <input
                type="file"
                accept=".sol,.ts,.tsx,.js,.jsx,.py,.rs,.go,.java,.cs,.c,.cpp,.h,.hpp,.php,.rb,.swift,.kt,.kts,.txt"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>
            <Field label="Source content">
              <textarea
                className="input"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Paste the code you want CodeProof to audit..."
              />
            </Field>
          </div>
        </Panel>

        <Panel>
          <div className="panel-header">
            <h2>Source provenance</h2>
            <Badge tone={publicKey || signature ? "success" : "neutral"}>
              Optional Ed25519
            </Badge>
          </div>
          <div className="panel-body grid-2">
            <Field label="Public key" hint="32-byte hex">
              <input
                className="input mono"
                value={publicKey}
                onChange={(event) => setPublicKey(event.target.value)}
                placeholder="0x..."
              />
            </Field>
            <Field label="Signature" hint="64-byte hex">
              <input
                className="input mono"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                placeholder="0x..."
              />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="stack">
        <Panel>
          <div className="panel-header">
            <h2>Preflight</h2>
            <Badge tone={canSubmit ? "success" : "pending"}>
              {canSubmit ? "Ready" : "Check required"}
            </Badge>
          </div>
          <div className="panel-body preflight">
            <CheckRow
              label="Wallet"
              value={isConnected ? formatAddress(address) : "Not connected"}
              ok={isConnected}
            />
            <CheckRow
              label="Contract"
              value={isConfigured ? "Configured" : "Address missing"}
              ok={isConfigured}
            />
            <CheckRow
              label="Sender lock"
              value={pendingJob ? "Pending job" : "Available"}
              ok={!pendingJob}
            />
            <CheckRow
              label="LLM executor"
              value={
                loadingExecutors
                  ? "Discovering"
                  : formatAddress(executors?.llm?.address)
              }
              ok={Boolean(executors?.llm)}
            />
            <CheckRow
              label="Contract wallet"
              value={`${formatEther(walletBalance)} RITUAL`}
              ok
            />
            <CheckRow
              label="Lock until"
              value={lockUntil ? `block ${lockUntil}` : "Deposit on request"}
              ok
            />
            <CheckRow
              label="Review fee"
              value={`${formatEther(fee)} RITUAL`}
              ok={fee > 0n}
            />
            <div className="check-row" style={{ display: "block" }}>
              <Field label="Execution budget" hint="Deposited to contract wallet">
                <input
                  className="input"
                  inputMode="decimal"
                  value={executionBudget}
                  onChange={(event) => setExecutionBudget(event.target.value)}
                />
              </Field>
            </div>
            <CheckRow
              label="Provenance"
              value={
                publicKey || signature
                  ? provenanceValid
                    ? "Valid shape"
                    : "Invalid key/signature"
                  : "Not supplied"
              }
              ok={provenanceValid}
            />
          </div>
          <div
            className="panel-body"
            style={{ borderTop: "1px solid var(--border-soft)" }}
          >
            <Button
              onClick={() => void submit()}
              disabled={!canSubmit}
              style={{ width: "100%" }}
            >
              {status ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {status ? status.replaceAll("_", " ") : "Audit with Ritual LLM"}
            </Button>
            {message && (
              <p
                className={status === "FAILED" ? "error" : ""}
                style={{ fontSize: 12 }}
              >
                {message}
              </p>
            )}
          </div>
        </Panel>

        {(status || recent?.[0]) && (
          <Panel>
            <div className="panel-header">
              <h2>Async lifecycle</h2>
              <Badge tone="pending">{status || recent?.[0]?.status}</Badge>
            </div>
            <div className="panel-body">
              <AsyncTimeline
                status={status || recent?.[0]?.status || "SUBMITTING"}
              />
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function CheckRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="check-row">
      <span>{label}</span>
      <span className={ok ? "" : "error"}>
        {ok ? (
          <Check size={13} style={{ display: "inline", marginRight: 6 }} />
        ) : (
          <KeyRound size={13} style={{ display: "inline", marginRight: 6 }} />
        )}
        {value}
      </span>
    </div>
  );
}
