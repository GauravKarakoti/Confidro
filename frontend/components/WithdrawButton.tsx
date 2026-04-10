"use client";

import { useAccount, useReadContract } from "wagmi";
import { useContract } from "@/hooks/useContract";
import { useDecrypt } from "@cofhe/react";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState } from "react";

export function WithdrawButton() {
  const { address } = useAccount();
  const { withdrawSalary } = useContract();
  const { decrypt, decryptedData, isDecrypting } = useDecrypt();
  const [salaryAmount, setSalaryAmount] = useState<number | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Read encrypted salary for the connected user
  const { data: encryptedSalary, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "salaries",
    args: [address],
    query: { enabled: !!address },
  });

  const handleDecryptAndWithdraw = async () => {
    if (!encryptedSalary) return;
    try {
      const decrypted = await decrypt(encryptedSalary);
      const salaryNum = Number(decrypted);
      if (salaryNum > 0) {
        setSalaryAmount(salaryNum);
        setIsWithdrawing(true);
        await withdrawSalary();
        alert(`Withdrew $${(salaryNum / 100).toFixed(2)} USDC`);
        refetch();
      } else {
        alert("No salary to withdraw.");
      }
    } catch (err) {
      console.error(err);
      alert("Decryption or withdrawal failed.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!address) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={handleDecryptAndWithdraw}
        disabled={isDecrypting || isWithdrawing}
        className="btn-primary w-full"
      >
        {isDecrypting ? "Decrypting..." : isWithdrawing ? "Withdrawing..." : "Decrypt & Withdraw"}
      </button>
      {salaryAmount !== null && (
        <div className="text-sm text-green-600">
          Your salary: ${(salaryAmount / 100).toFixed(2)} USDC
        </div>
      )}
    </div>
  );
}