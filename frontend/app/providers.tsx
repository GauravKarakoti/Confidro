"use client";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { arbitrumSepolia, baseSepolia, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import dynamic from "next/dynamic";

// 1. Dynamically import CofheProvider with SSR disabled
const CofheProvider = dynamic(
  () => import("@cofhe/react").then((mod) => mod.CofheProvider),
  { ssr: false }
);

const config = getDefaultConfig({
  appName: "Confidro",
  projectId: "YOUR_WALLET_CONNECT_PROJECT_ID", // Get from https://cloud.walletconnect.com
  chains: [arbitrumSepolia, baseSepolia, sepolia],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {/* 2. Wrap your app with the dynamically imported provider */}
          <CofheProvider>
            {children}
          </CofheProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}