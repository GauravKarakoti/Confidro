"use client";

import { useState } from "react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { AddEmployeeForm } from "@/components/AddEmployeeForm";
import { EmployeeList } from "@/components/EmployeeList";
import { WithdrawButton } from "@/components/WithdrawButton";
import { useContract } from "@/hooks/useContract";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();
  const { processPayroll, getDecryptedTotal } = useContract();
  const [totalPayroll, setTotalPayroll] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
    const total = await getDecryptedTotal();
    setTotalPayroll(total);
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
                  <button onClick={handleShowTotal} className="btn-secondary w-full">
                    Show Total Payroll (Owner Only)
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