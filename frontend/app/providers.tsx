"use client";

import { WagmiProvider } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defaultWagmiConfig } from "@web3modal/wagmi/react/config";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { ReactNode, useState } from "react";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

const metadata = {
  name: "Confidro",
  description: "Confidro Payroll",
  url: process.env.NEXT_PUBLIC_FRONTEND_URL!,
  icons: ["https://avatars.githubusercontent.com/u/37784886"]
};

const chains = [baseSepolia] as const;

// Create wagmiConfig using Web3Modal's default configuration
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

// Initialize Web3Modal
createWeb3Modal({
  wagmiConfig,
  projectId,
  enableAnalytics: false,
  themeVariables: {
    '--w3m-accent': '#5A29E4', // Matching your previous accent color
    '--w3m-border-radius-master': '2px', // Gives the modal a modern look
  }
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}