import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

export function useContract() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Add employee is handled in AddEmployeeForm using useWriteContract directly
  // but we expose common actions here

  const processPayroll = async () => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "processPayroll",
    });
  };

  const getEncryptedTotal = async (): Promise<string | null> => {
    // Only owner can call this view function
    if (!address) return null;
    try {
      const result = await useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getEncryptedTotal",
        args: [],
      });
      return result?.toString() ?? null;
    } catch (error) {
      console.error("Failed to fetch total payroll:", error);
      return null;
    }
  };

  const withdrawSalary = async () => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "withdrawSalary",
    });
  };

  return {
    processPayroll,
    getEncryptedTotal,
    withdrawSalary,
  };
}