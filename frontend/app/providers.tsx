"use client";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { arbitrumSepolia, baseSepolia, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FhenixProvider } from "@cofhe/react";
import "@rainbow-me/rainbowkit/styles.css";

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
          <FhenixProvider>
            {children}
          </FhenixProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}