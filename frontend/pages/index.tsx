import { useEncrypt, useDecrypt, FhenixProvider } from '@cofhe/react';
import { useState } from 'react';
import { useWriteContract, useAccount } from 'wagmi';

const CONTRACT_ADDRESS = "0x9f3E...c7A2"; // Replace with deployed address
const ABI: any = [ /* Paste contract ABI from artifacts/contracts/ConfidroPayroll.sol/ConfidroPayroll.json */ ];

function PayrollForm() {
  const { address } = useAccount();
  const { encrypt, encryptedData, isEncrypting } = useEncrypt();
  const { writeContract } = useWriteContract();
  const { decrypt, decryptedData } = useDecrypt();
  
  const [employeeAddress, setEmployeeAddress] = useState('');
  const [salaryNum, setSalaryNum] = useState(0);
  
  const handleAddEmployee = async () => {
    if (!salaryNum) return;
    const encrypted = await encrypt(salaryNum);
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'addEmployee',
      args: [employeeAddress, encrypted],
    });
  };
  
  const handleProcessPayroll = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'processPayroll',
      args: [],
    });
  };
  
  const handleWithdraw = async () => {
    // First decrypt your own salary (requires permit)
    const mySalaryEncrypted = await readContract({ ... }); // fetch from mapping
    const decrypted = await decrypt(mySalaryEncrypted);
    if (decrypted > 0) {
      writeContract({ functionName: 'withdrawSalary' });
    }
  };
  
  return (
    <div>
      <input placeholder="Employee address" onChange={e => setEmployeeAddress(e.target.value)} />
      <input type="number" placeholder="Salary (USDC cents)" onChange={e => setSalaryNum(Number(e.target.value))} />
      <button onClick={handleAddEmployee} disabled={isEncrypting}>Add Employee</button>
      <button onClick={handleProcessPayroll}>Process Payroll</button>
      <button onClick={handleWithdraw}>Withdraw My Salary</button>
    </div>
  );
}

export default function Home() {
  return (
    <FhenixProvider>
      <PayrollForm />
    </FhenixProvider>
  );
}