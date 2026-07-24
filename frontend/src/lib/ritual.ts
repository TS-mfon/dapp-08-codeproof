import { defineChain, http } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const walletRpc =
  process.env.NEXT_PUBLIC_RITUAL_WALLET_RPC_URL ||
  "https://frontend-alpha-pied-17.vercel.app/api/rpc";

export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: {
    default: {
      http: [walletRpc],
      webSocket: ["wss://rpc.ritualfoundation.org/ws"],
    },
  },
  blockExplorers: {
    default: {
      name: "Ritual Explorer",
      url: "https://explorer.ritualfoundation.org",
    },
  },
  contracts: {
    multicall3: {
      address: "0x5577Ea679673Ec7508E9524100a188E7600202a3",
    },
  },
});

export const wagmiConfig = getDefaultConfig({
  appName: "CodeProof",
  appDescription: "Simple multi-language code audits powered by Ritual LLM",
  appUrl: "https://frontend-alpha-pied-17.vercel.app",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [ritualChain],
  transports: {
    [ritualChain.id]: http(walletRpc),
  },
  ssr: true,
});

export const addresses = {
  zero: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  certificate: (process.env.NEXT_PUBLIC_CERTIFICATE_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  ritualWallet:
    "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as `0x${string}`,
  asyncJobTracker:
    "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5" as `0x${string}`,
  teeRegistry:
    "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as `0x${string}`,
};

export const isConfigured = !/^0x0{40}$/i.test(addresses.registry);
