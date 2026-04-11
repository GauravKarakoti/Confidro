import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/lib/contract';
import { useCofheEncrypt, useCofheReadContractAndDecrypt } from '@cofhe/react';
// 1. Import assertCorrectEncryptedItemInput
import { Encryptable, assertCorrectEncryptedItemInput } from '@cofhe/sdk';
import { useState } from 'react';
import { useWriteContract, useAccount } from 'wagmi';

function PayrollForm() {
  const { address } = useAccount();
  const { encryptInputsAsync, isEncrypting } = useCofheEncrypt();
  const { writeContract } = useWriteContract();
  
  const { decrypted } = useCofheReadContractAndDecrypt({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "salaries",
    args: address ? [address as `0x${string}`] : undefined,
  });
  
  const [employeeAddress, setEmployeeAddress] = useState('');
  const [salaryNum, setSalaryNum] = useState(0);
  
  const handleAddEmployee = async () => {
    if (!salaryNum) return;

    const encryptedArray = await encryptInputsAsync([
      Encryptable.uint64(BigInt(salaryNum))
    ]);
    const encrypted = encryptedArray[0];

    // 2. Assert the encrypted input to satisfy Viem's `0x${string}` requirement
    assertCorrectEncryptedItemInput(encrypted);

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'addEmployee',
      args: [employeeAddress as `0x${string}`, encrypted],
    });
  };
  
  const handleProcessPayroll = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'processPayroll',
      args: [],
    });
  };
  
  const handleWithdraw = () => {
    const salary = decrypted.data;
    
    if (salary !== undefined && salary > BigInt(0)) {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'withdrawSalary'
      });
    }
  };
  
  return (
    <div>
      <input placeholder="Employee address" onChange={e => setEmployeeAddress(e.target.value)} />
      <input type="number" placeholder="Salary (USDC cents)" onChange={e => setSalaryNum(Number(e.target.value))} />
      <button onClick={handleAddEmployee} disabled={isEncrypting}>
        {isEncrypting ? "Encrypting..." : "Add Employee"}
      </button>
      <button onClick={handleProcessPayroll}>Process Payroll</button>
      <button onClick={handleWithdraw}>Withdraw My Salary</button>
    </div>
  );
}

export default function Home() {
  return (
    <PayrollForm />
  );
}