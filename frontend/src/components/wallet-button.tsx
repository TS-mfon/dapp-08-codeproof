"use client";

import { LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ritualChain } from "@/lib/ritual";
import { Button } from "./ui";

const short = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (isConnected && chainId !== ritualChain.id) {
    return (
      <Button
        variant="secondary"
        onClick={() => switchChain({ chainId: ritualChain.id })}
        disabled={switching}
      >
        <Wallet size={16} />
        {switching ? "Switching" : "Switch to Ritual"}
      </Button>
    );
  }
  if (address) {
    return (
      <Button variant="ghost" onClick={() => disconnect()}>
        <span className="network-dot" />
        {short(address)}
        <LogOut size={15} />
      </Button>
    );
  }
  return (
    <Button
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
      disabled={isPending || !connectors[0]}
    >
      <Wallet size={16} />
      {isPending ? "Connecting" : "Connect wallet"}
    </Button>
  );
}
