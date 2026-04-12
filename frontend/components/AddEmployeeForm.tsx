"use client";

import { useState } from "react";
// 🚨 Import usePublicClient
import { useWriteContract, usePublicClient } from "wagmi"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useEncryptedSalary } from "@/hooks/useEncryptedSalary";
import { assertCorrectEncryptedItemInput } from "@cofhe/sdk";

export function AddEmployeeForm() {
  const [employeeAddress, setEmployeeAddress] = useState("");
  const [salary, setSalary] = useState("");
  const { writeContractAsync, isPending } = useWriteContract();
  const { encryptSalary, isEncrypting, error: encryptError } = useEncryptedSalary();
  
  // 🚨 Initialize publicClient
  const publicClient = usePublicClient(); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeAddress || !salary) return;

    const salaryCents = Math.round(parseFloat(salary) * 100);
    if (isNaN(salaryCents) || salaryCents <= 0) {
      alert("Invalid salary amount");
      return;
    }

    try {
      const encryptedSalary = await encryptSalary(salaryCents);
      assertCorrectEncryptedItemInput(encryptedSalary);

      // 🚨 Capture the transaction hash returned by writeContractAsync
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "addEmployee",
        args: [employeeAddress as `0x${string}`, encryptedSalary],
        gas: BigInt(25000000), 
      });

      // 🚨 Wait for the transaction to be mined before proceeding
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      alert("Employee added successfully!");
      setEmployeeAddress("");
      setSalary("");
    } catch (err) {
      console.error(err);
      alert("Failed to add employee.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700">Employee Wallet</label>
        <input
          type="text"
          value={employeeAddress}
          onChange={(e) => setEmployeeAddress(e.target.value)}
          placeholder="0x..."
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Salary (USDC)</label>
        <input
          type="number"
          step="0.01"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          placeholder="e.g., 1000.00"
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isPending || isEncrypting}
        className="btn-primary w-full"
      >
        {isEncrypting ? "Encrypting..." : isPending ? "Adding..." : "Add Employee"}
      </button>
      {encryptError && <p className="text-red-500 text-sm">Encryption failed</p>}
    </form>
  );
}