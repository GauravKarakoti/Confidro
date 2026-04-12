import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";
import { Encryptable } from "@cofhe/sdk";
import { useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { arbSepolia, baseSepolia, sepolia } from "@cofhe/sdk/chains";

export function useEncryptedSalary() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastEncrypted, setLastEncrypted] = useState<any>(null);

  // Fetch Wagmi clients to connect the CoFHE client to the correct network
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const encryptSalary = async (salaryAmount: number) => {
    setIsEncrypting(true);
    setError(null);
    try {
      // 1. Create the web configuration
      // Note: If you have specific CoFHE chains, you can import them from '@cofhe/sdk/chains' 
      // and pass them into supportedChains.
      const config = createCofheConfig({
        supportedChains: [baseSepolia, arbSepolia, sepolia], 
        environment: "web"
      });

      // 2. Initialize the CoFHE web client with the config
      const client = await createCofheClient(config);

      // 3. Connect the client to Wagmi so it can resolve the active chainId to fetch FHE keys
      if (publicClient && walletClient) {
        await client.connect(publicClient as any, walletClient as any);
      }
      
      // 4. Wrap the data and call .execute() instead of .encrypt()
      const encryptResult = await client.encryptInputs([
        Encryptable.uint32(BigInt(salaryAmount))
      ]).execute();
      
      // Extract the single encrypted value from the returned array
      const encrypted = encryptResult[0];
      
      setLastEncrypted(encrypted);
      return encrypted;
    } catch (err: any) {
      console.error(err);
      setError(err);
      throw err;
    } finally {
      setIsEncrypting(false);
    }
  };

  return {
    encryptSalary,
    encryptedData: lastEncrypted,
    isEncrypting,
    error,
  };
}