"use client";

import {
  BadgeCheck,
  FileCode2,
  Gauge,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./wallet-button";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/review", label: "New review", icon: FileCode2 },
  { href: "/certificates", label: "Certificates", icon: BadgeCheck },
  { href: "/admin", label: "Admin", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="CodeProof home">
          <span className="brand-mark">
            <Gauge size={20} />
          </span>
          <span>
            <strong>CodeProof</strong>
            <small>Ritual review network</small>
          </span>
        </Link>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={
                pathname === href ||
                (href !== "/" && pathname.startsWith(`${href}/`))
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-meta">
          <span className="network-dot" />
          Ritual Chain
          <small>Chain ID 1979</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="mobile-brand">CodeProof</span>
          </div>
          <WalletButton />
        </header>
        <main>{children}</main>
      </div>
      <nav className="mobile-nav">
        {links.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={pathname === href ? "active" : ""}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
