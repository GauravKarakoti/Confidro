export const CONTRACT_ADDRESS = "0x9f3E...c7A2"; // Replace with your deployed contract address

export const CONTRACT_ABI = [
  // Paste the actual ABI from your compiled contract.
  // For now, placeholder functions:
  {
    "inputs": [{ "name": "employee", "type": "address" }, { "name": "encryptedSalary", "type": "euint32" }],
    "name": "addEmployee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "processPayroll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawSalary",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getEncryptedTotal",
    "outputs": [{ "name": "", "type": "uint32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "", "type": "address" }],
    "name": "salaries",
    "outputs": [{ "name": "", "type": "euint32" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;