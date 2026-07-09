"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-1.5 px-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const injectedConnector = connectors.find((c) => c.id === "injected") || connectors[0];
        if (injectedConnector) {
          connect({ connector: injectedConnector });
        }
      }}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-lg hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer"
    >
      Connect Wallet
    </button>
  );
}
