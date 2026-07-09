import type { Metadata } from "next";
import { Outfit, Fira_Code } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";

import { WalletConnectButton } from "./WalletConnectButton";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeProof | On-Chain Code Reviews & Certificate Registry",
  description: "TEE-verified AI smart contract auditing and Soulbound NFT certificate registry on Ritual Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${firaCode.variable} dark`}>
      <body className="font-sans antialiased text-slate-100 flex flex-col min-h-screen">
        <Providers>
          <header className="glass sticky top-0 z-50 border-b border-white/5 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
                  <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-transparent bg-clip-text font-black">
                    CodeProof
                  </span>
                </Link>
                <nav className="hidden md:flex items-center gap-6">
                  <Link href="/review" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                    Request Review
                  </Link>
                  <Link href="/certificates" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                    Certificates
                  </Link>
                  <Link href="/admin" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                    Admin
                  </Link>
                </nav>
              </div>

              {/* Simple Connection State */}
              <div className="flex items-center gap-4">
                <WalletConnectButton />
              </div>
            </div>
          </header>

          <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          <footer className="border-t border-white/5 py-6 mt-auto bg-slate-950/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} CodeProof. Powered by Ritual Chain.
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <a href="https://explorer.ritualfoundation.org" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Ritual Explorer
                </a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
