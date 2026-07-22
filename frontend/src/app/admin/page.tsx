"use client";

import { Pause, Play, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { encodeFunctionData, formatEther, parseEther } from "viem";
import {
  useAccount,
  useReadContracts,
  useSendTransaction,
} from "wagmi";
import { Badge, Button, Field, Panel } from "@/components/ui";
import { registryAbi } from "@/lib/abi";
import { addresses, isConfigured } from "@/lib/ritual";

export default function AdminPage() {
  const { address } = useAccount();
  const { sendTransactionAsync, isPending } = useSendTransaction();
  const [fastFee, setFastFee] = useState("0.01");
  const [deepFee, setDeepFee] = useState("0.03");
  const [threshold, setThreshold] = useState("70");
  const { data, refetch } = useReadContracts({
    contracts: [
      {
        address: addresses.registry,
        abi: registryAbi,
        functionName: "owner",
      },
      {
        address: addresses.registry,
        abi: registryAbi,
        functionName: "paused",
      },
      {
        address: addresses.registry,
        abi: registryAbi,
        functionName: "fastReviewFee",
      },
      {
        address: addresses.registry,
        abi: registryAbi,
        functionName: "deepReviewFee",
      },
      {
        address: addresses.registry,
        abi: registryAbi,
        functionName: "passingScoreThreshold",
      },
      {
        address: addresses.registry,
        abi: registryAbi,
        functionName: "treasury",
      },
    ],
    query: { enabled: isConfigured },
  });
  const owner = data?.[0]?.result as string | undefined;
  const paused = Boolean(data?.[1]?.result);
  const isOwner = address?.toLowerCase() === owner?.toLowerCase();

  async function write(
    functionName: "setPaused" | "setFees" | "setPassingScoreThreshold",
    args: readonly unknown[],
  ) {
    await sendTransactionAsync({
      to: addresses.registry,
      data: encodeFunctionData({
        abi: registryAbi,
        functionName,
        args: args as never,
      }),
    });
    setTimeout(() => void refetch(), 1_500);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Registry controls</span>
          <h1>Protocol administration</h1>
          <p>
            Fee, eligibility, pause, ownership, and treasury values are read
            directly from the deployed registry.
          </p>
        </div>
        <Badge tone={isOwner ? "success" : "neutral"}>
          {isOwner ? "Owner connected" : "Read only"}
        </Badge>
      </div>
      <div className="content-grid">
        <div className="stack">
          <Panel>
            <div className="panel-header">
              <h2>Review economics</h2>
              <ShieldCheck size={17} className="muted" />
            </div>
            <div className="panel-body grid-2">
              <Field
                label="Fast review fee"
                hint={`Current ${formatEther((data?.[2]?.result as bigint) ?? 0n)}`}
              >
                <input
                  className="input"
                  value={fastFee}
                  onChange={(event) => setFastFee(event.target.value)}
                />
              </Field>
              <Field
                label="Deep review fee"
                hint={`Current ${formatEther((data?.[3]?.result as bigint) ?? 0n)}`}
              >
                <input
                  className="input"
                  value={deepFee}
                  onChange={(event) => setDeepFee(event.target.value)}
                />
              </Field>
            </div>
            <div className="panel-body" style={{ borderTop: "1px solid var(--border-soft)" }}>
              <Button
                disabled={!isOwner || isPending}
                onClick={() =>
                  void write("setFees", [
                    parseEther(fastFee),
                    parseEther(deepFee),
                  ])
                }
              >
                <Save size={15} />
                Update fees
              </Button>
            </div>
          </Panel>
          <Panel>
            <div className="panel-header">
              <h2>Certificate policy</h2>
            </div>
            <div className="panel-body grid-2">
              <Field
                label="Passing score"
                hint={`Current ${String(data?.[4]?.result ?? "--")}`}
              >
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
              </Field>
              <div style={{ alignSelf: "end" }}>
                <Button
                  disabled={!isOwner || isPending}
                  onClick={() =>
                    void write("setPassingScoreThreshold", [Number(threshold)])
                  }
                >
                  <Save size={15} />
                  Update threshold
                </Button>
              </div>
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel>
            <div className="panel-header">
              <h2>Emergency state</h2>
              <Badge tone={paused ? "danger" : "success"}>
                {paused ? "Paused" : "Active"}
              </Badge>
            </div>
            <div className="panel-body stack">
              <Button
                variant={paused ? "primary" : "danger"}
                disabled={!isOwner || isPending}
                onClick={() => void write("setPaused", [!paused])}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
                {paused ? "Resume requests" : "Pause requests"}
              </Button>
              <p style={{ fontSize: 12, margin: 0 }}>
                Pausing blocks new fast, deep, and revision requests. Existing
                callbacks remain deliverable.
              </p>
            </div>
          </Panel>
          <Panel>
            <div className="panel-header">
              <h2>Authority</h2>
            </div>
            <div className="panel-body stack">
              <Anchor label="Owner" value={owner} />
              <Anchor
                label="Treasury"
                value={data?.[5]?.result as string | undefined}
              />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Anchor({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 5 }}>
        {label}
      </div>
      <div className="code-hash mono">{value || "Not configured"}</div>
    </div>
  );
}
