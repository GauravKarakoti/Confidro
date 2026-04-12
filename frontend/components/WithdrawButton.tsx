"use client";

import { useAccount, useReadContract, usePublicClient, useWalletClient } from "wagmi";
import { useContract } from "@/hooks/useContract";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState, useEffect } from "react";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";
import { FheTypes } from "@cofhe/sdk";
import { arbSepolia, baseSepolia, sepolia } from "@cofhe/sdk/chains";

export function WithdrawButton() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { withdrawSalary } = useContract();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  const [decryptedData, setDecryptedData] = useState<string | undefined>(undefined);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // 1. Read the encrypted FHE value from the contract using standard Wagmi
  const { data: encryptedData, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: "salaries",
    args: [address as `0x${string}`],
    query: { enabled: !!address }
  });

  // 2. Decrypt the value locally using the CoFHE SDK
  useEffect(() => {
    async function decrypt() {
      // Ensure we have the encrypted data, the user's address, and Wagmi clients
      if (!encryptedData || !address || !publicClient) return;
      
      setIsDecrypting(true);
      try {
        // Initialize the Web Configuration
        const config = createCofheConfig({
          supportedChains: [baseSepolia, arbSepolia, sepolia], 
          environment: "web"
        });
        
        const client = await createCofheClient(config);

        // Connect the Wagmi clients so the SDK knows the current network state
        if (publicClient && walletClient) {
          await client.connect(publicClient as any, walletClient as any);
        }

        // Use the updated decryptForView builder pattern
        const decryptedValue = await client.decryptForView(
          encryptedData as bigint | string, 
          FheTypes.Uint32 // Match the uint32 used during encryption
        )
        .withPermit() // Use the active permit connected to the account
        .execute();

        setDecryptedData(decryptedValue.toString());
      } catch (err) {
        console.error("Decryption failed:", err);
      } finally {
        setIsDecrypting(false);
      }
    }
    decrypt();
  }, [encryptedData, address, publicClient, walletClient]);

  const handleWithdraw = async () => {
    // Prevent action if data isn't fully decrypted yet
    if (decryptedData === undefined) {
      alert("Salary not ready or no permit.");
      return;
    }

    try {
      const salaryNum = Number(decryptedData);
      if (salaryNum > 0) {
        setIsWithdrawing(true);
        await withdrawSalary();
        alert(`Withdrew $${(salaryNum / 100).toFixed(2)} USDC`);
        
        // Refetch the on-chain value so the UI updates
        refetch(); 
      } else {
        alert("No salary to withdraw.");
      }
    } catch (err) {
      console.error(err);
      alert("Withdrawal failed.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!address) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={handleWithdraw}
        disabled={isDecrypting || isWithdrawing || decryptedData === undefined}
        className="btn-primary w-full"
      >
        {isDecrypting 
          ? "Decrypting..." 
          : isWithdrawing 
            ? "Withdrawing..." 
            : "Withdraw"}
      </button>
      
      {decryptedData !== undefined && (
        <div className="text-sm text-green-600">
          Your salary: ${(Number(decryptedData) / 100).toFixed(2)} USDC
        </div>
      )}
    </div>
  );
}