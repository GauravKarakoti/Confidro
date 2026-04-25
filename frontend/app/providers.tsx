"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { ReactNode, useState } from "react";

const chains = [baseSepolia] as const;

const wagmiConfig = createConfig(
  getDefaultConfig({
    chains,
    transports: {
      [baseSepolia.id]: http(),
    },
    // WalletConnect ID is strictly a fallback here for mobile scanning
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    
    appName: "Confidro",
    appDescription: "Confidro Payroll",
    appUrl: process.env.NEXT_PUBLIC_FRONTEND_URL!,
    appIcon: "https://avatars.githubusercontent.com/u/37784886",
  })
);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          customTheme={{
            "--ck-accent-color": "#5A29E4",
            "--ck-accent-text-color": "#ffffff",
            "--ck-border-radius": "2px",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}