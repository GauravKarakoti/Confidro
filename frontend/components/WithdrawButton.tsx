"use client";

import { useAccount } from "wagmi";
import { useContract } from "@/hooks/useContract";
import { useCofheReadContractAndDecrypt } from "@cofhe/react";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState } from "react";

export function WithdrawButton() {
  const { address } = useAccount();
  const { withdrawSalary } = useContract();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // useCofheReadContractAndDecrypt handles both reading the FHE value from the contract 
  // and decrypting it using the user's active permit.
  const { encrypted, decrypted } = useCofheReadContractAndDecrypt({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: "salaries",
    args: [address as `0x${string}`],
  }, {
    readQueryOptions: { enabled: !!address }
  });

  const handleWithdraw = async () => {
    // Prevent action if data isn't fully decrypted yet
    if (decrypted.data === undefined) {
      alert("Salary not ready or no permit.");
      return;
    }

    try {
      const salaryNum = Number(decrypted.data);
      if (salaryNum > 0) {
        setIsWithdrawing(true);
        await withdrawSalary();
        alert(`Withdrew $${(salaryNum / 100).toFixed(2)} USDC`);
        
        // Refetch the on-chain value so the UI updates
        encrypted.refetch(); 
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
        disabled={decrypted.isFetching || isWithdrawing || decrypted.data === undefined}
        className="btn-primary w-full"
      >
        {decrypted.isFetching 
          ? "Decrypting..." 
          : isWithdrawing 
            ? "Withdrawing..." 
            : "Withdraw"}
      </button>
      
      {decrypted.data !== undefined && (
        <div className="text-sm text-green-600">
          Your salary: ${(Number(decrypted.data) / 100).toFixed(2)} USDC
        </div>
      )}
    </div>
  );
}