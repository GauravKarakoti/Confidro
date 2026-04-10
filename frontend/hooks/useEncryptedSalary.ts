import { useEncrypt } from "@cofhe/react";
import { useState } from "react";

export function useEncryptedSalary() {
  const { encrypt, encryptedData, isEncrypting, error } = useEncrypt();
  const [lastEncrypted, setLastEncrypted] = useState<any>(null);

  const encryptSalary = async (salaryAmount: number) => {
    // Salary is in cents (e.g., 1000 = $10.00)
    const encrypted = await encrypt(salaryAmount);
    setLastEncrypted(encrypted);
    return encrypted;
  };

  return {
    encryptSalary,
    encryptedData: lastEncrypted,
    isEncrypting,
    error,
  };
}