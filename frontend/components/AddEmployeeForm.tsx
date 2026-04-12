"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useEncryptedSalary } from "@/hooks/useEncryptedSalary";
// 1. Import the assertion utility
import { assertCorrectEncryptedItemInput } from "@cofhe/sdk";

export function AddEmployeeForm() {
  const [employeeAddress, setEmployeeAddress] = useState("");
  const [salary, setSalary] = useState("");
  const { writeContractAsync, isPending } = useWriteContract();
  const { encryptSalary, isEncrypting, error: encryptError } = useEncryptedSalary();

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
      
      // Assert the encrypted payload to satisfy Viem's typings
      assertCorrectEncryptedItemInput(encryptedSalary);

      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "addEmployee",
        args: [employeeAddress as `0x${string}`, encryptedSalary],
        // 🚨 ADD THIS LINE: Explicitly set a high gas limit to bypass Viem's estimation failure
        gas: BigInt(25000000), 
      });
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