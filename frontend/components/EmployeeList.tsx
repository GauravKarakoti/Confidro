"use client";

import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

export function EmployeeList() {
  const { data: employees, isLoading, isError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getEmployees",
    // 🚨 Add this query block to auto-refresh the list
    query: {
      refetchInterval: 3000, // Polls every 3 seconds
    }
  });

  if (isLoading) {
    return <div className="text-gray-500 text-sm">Loading employees...</div>;
  }

  if (isError) {
    return <div className="text-red-500 text-sm">Error loading employees.</div>;
  }

  const employeeList = (employees as string[]) || [];

  return (
    <div className="space-y-2">
      <p className="text-gray-500 text-sm">Active Employees:</p>
      {employeeList.length === 0 && (
        <div className="bg-gray-50 rounded p-3 text-center text-gray-400">
          No employees added yet.
        </div>
      )}
      {employeeList.map((emp, idx) => (
        <div key={idx} className="bg-gray-50 p-2 rounded text-sm font-mono break-all">
          {emp}
        </div>
      ))}
    </div>
  );
}