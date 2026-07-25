"use client";

import { CircleDotDashed } from "lucide-react";
import { WalletButton } from "./wallet-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="simple-app">
      <header className="simple-topbar">
        <div className="simple-brand">
          <span className="simple-brand-mark">
            <CircleDotDashed size={19} />
          </span>
          <span>
            <strong>Ritual Code Auditor</strong>
            <small>An invocation on Ritual Chain</small>
          </span>
        </div>
        <WalletButton />
      </header>
      <main className="simple-main">{children}</main>
    </div>
  );
}
