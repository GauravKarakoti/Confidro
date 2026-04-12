"use client";

import { useAccount, useReadContract, usePublicClient, useWalletClient } from "wagmi";
import { useContract } from "@/hooks/useContract";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState } from "react";
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

  // Read the encrypted FHE value from the contract
  const { data: encryptedData, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: "salaries",
    args: [address as `0x${string}`],
    query: { enabled: !!address }
  });

  const handleRevealSalary = async () => {
    if (!encryptedData || !address || !publicClient || !walletClient) {
      alert("Please ensure your wallet is connected.");
      return;
    }

    setIsDecrypting(true);
    try {
      const config = createCofheConfig({
        supportedChains: [baseSepolia, arbSepolia, sepolia], 
        environment: "web"
      });
      
      const client = await createCofheClient(config);

      // Connect the Wagmi clients
      await client.connect(publicClient as any, walletClient as any);

      // 1. Correctly fetch or request the wallet signature using the permits namespace
      const permit = await client.permits.getOrCreateSelfPermit();

      // 2. Explicitly pass the permit into the decryption builder
      const decryptedValue = await client.decryptForView(
        encryptedData as bigint | string, 
        FheTypes.Uint32 
      )
      .withPermit(permit) // Use the permit we just retrieved
      .execute();

      setDecryptedData(decryptedValue.toString());
    } catch (err) {
      console.error("Decryption failed:", err);
      alert("Failed to decrypt salary. Please ensure you sign the permit request.");
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      await withdrawSalary();
      alert("Withdrawal successful!");
      
      // Refetch the on-chain value to clear the UI
      refetch(); 
      setDecryptedData(undefined); // Reset decrypted state after withdrawal
    } catch (err) {
      console.error(err);
      alert("Withdrawal failed.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!address) return null;

  return (
    <div className="space-y-4">
      {decryptedData === undefined ? (
        <button
          onClick={handleRevealSalary}
          disabled={isDecrypting || !encryptedData}
          className="btn-secondary w-full"
        >
          {isDecrypting ? "Requesting Signature & Decrypting..." : "Reveal My Salary"}
        </button>
      ) : (
        <div className="p-3 bg-green-50 rounded-md border border-green-200">
          <p className="text-sm text-green-800 mb-3">
            Available Salary: ${(Number(decryptedData) / 100).toFixed(2)} USDC
          </p>
          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || Number(decryptedData) === 0}
            className="btn-primary w-full"
          >
            {isWithdrawing ? "Processing Withdrawal..." : "Withdraw Funds"}
          </button>
        </div>
      )}
    </div>
  );
}