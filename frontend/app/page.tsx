"use client";

import { useState } from "react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { EmployeeList } from "@/components/EmployeeList";
import { WithdrawButton } from "@/components/WithdrawButton";
import { useContract } from "@/hooks/useContract";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import dynamic from "next/dynamic";

// ADD THIS DYNAMIC IMPORT:
// Disable SSR for the form since it relies on browser-only cryptography libraries
const AddEmployeeForm = dynamic(
  () => import("@/components/AddEmployeeForm").then((mod) => mod.AddEmployeeForm),
  { ssr: false }
);

export default function Home() {
  const { isConnected } = useAccount();
  const { processPayroll, getEncryptedTotal } = useContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [totalPayroll, setTotalPayroll] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDecryptingTotal, setIsDecryptingTotal] = useState(false);;

  const handleProcessPayroll = async () => {
    setIsProcessing(true);
    try {
      await processPayroll();
      alert("Payroll processed successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to process payroll.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowTotal = async () => {
    if (!publicClient || !walletClient) {
      alert("Wallet clients not ready.");
      return;
    }

    setIsDecryptingTotal(true);
    try {
      // Dynamically import the browser-only cryptography modules on demand
      const { createCofheClient, createCofheConfig } = await import("@cofhe/sdk/web");
      const { arbSepolia, baseSepolia, sepolia } = await import("@cofhe/sdk/chains");
      const { FheTypes } = await import("@cofhe/sdk");

      // Step A: Fetch the encrypted ciphertext
      const encryptedTotal = await getEncryptedTotal();
      if (!encryptedTotal) return;

      // Step B: Initialize the CoFHE client
      const config = createCofheConfig({
        supportedChains: [baseSepolia, arbSepolia, sepolia],
        environment: "web"
      });
      const client = await createCofheClient(config);
      await client.connect(publicClient as any, walletClient as any);

      // Step C: Request/fetch the wallet signature
      const permit = await client.permits.getOrCreateSelfPermit();

      // Step D: Decrypt the ciphertext
      const decryptedTotal = await client.decryptForView(
        encryptedTotal,
        FheTypes.Uint32
      )
      .withPermit(permit)
      .execute();

      // Step E: Store the actual plaintext value
      setTotalPayroll(decryptedTotal.toString());
    } catch (error) {
      console.error("Failed to decrypt total payroll:", error);
      alert("Failed to decrypt total payroll. Ensure you signed the permit.");
    } finally {
      setIsDecryptingTotal(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-purple-800">Confidro</h1>
          <ConnectWallet />
        </div>

        {/* Tagline */}
        <p className="text-gray-600 text-lg">
          On-chain payroll that keeps salaries private — because your team's earnings shouldn't be public ledger data.
        </p>

        {isConnected ? (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left column */}
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">➕ Add Employee</h2>
                <AddEmployeeForm />
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold mb-4">💰 Payroll Controls</h2>
                <div className="space-y-3">
                  <button
                    onClick={handleProcessPayroll}
                    disabled={isProcessing}
                    className="btn-primary w-full"
                  >
                    {isProcessing ? "Processing..." : "Process Payroll"}
                  </button>
                  <button 
                    onClick={handleShowTotal} 
                    disabled={isDecryptingTotal}
                    className="btn-secondary w-full"
                  >
                    {isDecryptingTotal ? "Decrypting Total..." : "Show Total Payroll (Owner Only)"}
                  </button>
                  {totalPayroll !== null && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-green-800">
                      Total Payroll: ${(parseInt(totalPayroll) / 100).toFixed(2)} USDC
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">👥 Employees</h2>
                <EmployeeList />
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold mb-4">💸 Withdraw Your Salary</h2>
                <WithdrawButton />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 card">
            <p className="text-gray-500">Connect your wallet to manage payroll.</p>
          </div>
        )}
      </div>
    </main>
  );
}