"use client";

import { Wallet } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const connected = mounted && account && chain;

        if (!connected) {
          return (
            <button
              className="wallet-connect"
              type="button"
              onClick={openConnectModal}
            >
              <Wallet size={15} />
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              className="wallet-connect wallet-warning"
              type="button"
              onClick={openChainModal}
            >
              Switch network
            </button>
          );
        }

        return (
          <button
            className="wallet-connect wallet-connected"
            type="button"
            onClick={openAccountModal}
          >
            <span className="network-dot" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
