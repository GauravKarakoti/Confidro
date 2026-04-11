import { useCofheEncrypt } from "@cofhe/react";
import { Encryptable } from "@cofhe/sdk";
import { useState } from "react";

export function useEncryptedSalary() {
  const { encryptInputsAsync, isEncrypting, error } = useCofheEncrypt();
  const [lastEncrypted, setLastEncrypted] = useState<any>(null);

  const encryptSalary = async (salaryAmount: number) => {
    // 1. Convert the JS number to a BigInt (required by the Encryptable interface)
    // 2. Wrap it in the correct FHE type (e.g., uint64). 
    // Make sure 'uint64' matches the data type expected by your smart contract!
    const encryptedArray = await encryptInputsAsync([
      Encryptable.uint64(BigInt(salaryAmount))
    ]);
    
    // Extract the single encrypted value from the returned array
    const encrypted = encryptedArray[0];
    
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