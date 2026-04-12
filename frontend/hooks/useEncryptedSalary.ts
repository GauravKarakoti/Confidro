import { useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";

export function useEncryptedSalary() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastEncrypted, setLastEncrypted] = useState<any>(null);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const encryptSalary = async (salaryAmount: number) => {
    setIsEncrypting(true);
    setError(null);
    try {
      // 1. Move imports here to prevent build hanging
      const { createCofheClient, createCofheConfig } = await import("@cofhe/sdk/web");
      const { Encryptable } = await import("@cofhe/sdk");
      const { arbSepolia, baseSepolia, sepolia } = await import("@cofhe/sdk/chains");

      const config = createCofheConfig({
        supportedChains: [baseSepolia, arbSepolia, sepolia], 
        environment: "web"
      });

      const client = await createCofheClient(config);

      if (publicClient && walletClient) {
        await client.connect(publicClient as any, walletClient as any);
      }
      
      const encryptResult = await client.encryptInputs([
        Encryptable.uint32(BigInt(salaryAmount))
      ]).execute();
      
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