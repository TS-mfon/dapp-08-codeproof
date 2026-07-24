"use client";

import { ShieldCheck } from "lucide-react";
import { WalletButton } from "./wallet-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="simple-app">
      <header className="simple-topbar">
        <div className="simple-brand">
          <span className="simple-brand-mark">
            <ShieldCheck size={18} />
          </span>
          <span>
            <strong>CodeProof</strong>
            <small>Ritual LLM code audits</small>
          </span>
        </div>
        <WalletButton />
      </header>
      <main className="simple-main">{children}</main>
    </div>
  );
}
