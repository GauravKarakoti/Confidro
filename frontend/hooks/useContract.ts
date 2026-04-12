import { useWriteContract, useAccount, usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

export function useContract() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  // 1. Initialize the public client at the top level
  const publicClient = usePublicClient();

  const processPayroll = async () => {
    return writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "processPayroll",
      gas: BigInt(25000000), 
    });
  };

  const getEncryptedTotal = async (): Promise<string | null> => {
    // 2. Ensure both address and publicClient are available
    if (!address || !publicClient) return null;
    
    try {
      // 3. Use the publicClient to read the contract imperatively
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getEncryptedTotal",
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
      gas: BigInt(25000000), 
    });
  };

  return {
    processPayroll,
    getEncryptedTotal,
    withdrawSalary,
  };
}