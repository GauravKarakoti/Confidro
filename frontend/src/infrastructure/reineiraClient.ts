import { ReineiraSDK, SDKConfigWithKey } from '@reineira-os/sdk';

/**
 * Initializes the ReineiraOS SDK for server-side operations.
 * Must be called from Server Components, Route Handlers, or Server Actions.
 */
export const getReineiraClient = async () => {
  if (!process.env.ESCROW_CONTRACT_ADDRESS || !process.env.PUSDC_WRAPPER_ADDRESS) {
    throw new Error("Missing required ReineiraOS contract environment variables.");
  }

  // A private key is required for server-side SDK instantiation.
  // Add BACKEND_PRIVATE_KEY to your .env.local
  if (!process.env.BACKEND_PRIVATE_KEY) {
    throw new Error("Missing BACKEND_PRIVATE_KEY for server-side SDK initialization.");
  }

  const config: SDKConfigWithKey = {
    network: "testnet",
    rpcUrl: process.env.NEXT_PUBLIC_COFHE_RPC_URL!,
    privateKey: process.env.BACKEND_PRIVATE_KEY,
    addresses: {
      escrow: process.env.ESCROW_CONTRACT_ADDRESS,
      confidentialUSDC: process.env.PUSDC_WRAPPER_ADDRESS,
    }
  };

  // 1. Create the instance (Synchronous)
  const sdk = ReineiraSDK.create(config);

  // 2. Initialize the FHE client and provider (Asynchronous)
  if (!sdk.initialized) {
    await sdk.initialize();
  }

  return sdk;
};