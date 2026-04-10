# Confidro — Encrypted Payroll & Confidential Payment Protocol

[![Built with Fhenix](https://img.shields.io/badge/Built%20with-Fhenix-5A29E4)](https://fhenix.io)
[![Privara SDK](https://img.shields.io/badge/Privara-SDK-0A5C3E)](https://reineira.xyz)

**On-chain payroll that keeps salaries private — because your team's earnings shouldn't be public ledger data.**

Confidro is a privacy-preserving payroll protocol that enables organizations to run fully on-chain payroll with complete confidentiality. Using Fhenix's Fully Homomorphic Encryption (FHE), salary amounts remain encrypted throughout computation, while compliance officers can view aggregated totals for tax reporting.

---

## 📖 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
  - [Local Development](#local-development)
  - [Testing](#testing)
  - [Deployment](#deployment)
- [Smart Contracts](#smart-contracts)
- [Client Integration](#client-integration)
- [Security & Permissions](#security--permissions)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Overview

Confidro solves a fundamental problem in on-chain finance: **transparent payroll**.

Public blockchains expose every transaction. When you pay employees in crypto, their exact salary becomes visible to competitors, front-runners, and the entire world. This isn't just a privacy violation — it's a business risk.

Confidro leverages **Fully Homomorphic Encryption (FHE)** via **Fhenix** to enable:

- ✅ **Encrypted salary amounts** — stored and processed without decryption
- ✅ **Selective disclosure** — employees see their own salary; compliance sees totals
- ✅ **MEV protection** — encrypted mempool prevents front-running[reference:5]
- ✅ **Institutional compliance** — audit trails without exposing individual data
- ✅ **Cross-chain settlement** — via Privara SDK for multi-chain payroll

## Problem Statement

### The Transparency Tax

Public blockchains made transparency the default. That transparency enabled trustless systems — but it also created hard limits on what you can build.

| Problem | Impact |
|---|---|
| **Public salaries** | Competitors poach top talent; employee morale suffers |
| **MEV exposure** | Payroll transactions can be front-run or analyzed |
| **Institutional blockers** | Compliance teams reject transparent payroll systems |
| **Regulatory friction** | GDPR/CCPA violations from public PII exposure |

> "Major players evaluating on-chain infrastructure won't deploy on transparent rails. Compliance won't allow it." — *Fhenix Buildathon Brief*

Confidro removes these barriers by making payroll **confidential by design**.

### High-Level Flow
```text
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│ Employer │────▶│ Encrypt │────▶│ FHE Contract │
│ (Uploads │ │ Salaries │ │ (Processes │
│ Payroll) │ │ (Client) │ │ Encrypted) │
└─────────────┘ └─────────────┘ └────────┬────────┘
│
▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│ Employee │◀────│ Decrypt │◀────│ Settlement │
│ (Receives │ │ (Permit) │ │ (Privara) │
│ Payment) │ │ │ │ │
└─────────────┘ └─────────────┘ └─────────────────┘
```

### Step-by-Step

1. **Employer Setup** — Employer registers employees (wallet addresses + encrypted salary amounts)
2. **Encryption** — Salary values are encrypted client-side using `@cofhe/sdk` before submission
3. **Storage** — Contract stores `euint32` values (encrypted uint32) — never plaintext
4. **Payroll Processing** — Employer triggers `processPayroll()`; contract uses FHE to compute total without decryption
5. **Settlement** — Privara SDK handles cross-chain settlement and finality
6. **Employee Claim** — Employee submits decryption permit to view and withdraw their salary
7. **Compliance View** — Authorized auditors can request aggregated totals (selective disclosure)

## Architecture
```text
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (Next.js) │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│ │ useEncrypt │ │ useWrite │ │ useDecrypt │ │
│ │ (@cofhe/react)│ │ (wagmi) │ │ (@cofhe/react) │ │
│ └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘ │
└─────────┼──────────────────┼─────────────────────┼───────────────┘
│ │ │
▼ ▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ @cofhe/sdk (Client SDK) │
│ • Encryption/decryption • Permit management • Key generation │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ CoFHE Coprocessor │
│ • Task Manager • Slim Listener • Result Processor • FHEOS │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ ConfidroPayroll.sol (Solidity) │
│ • euint32 salary storage • FHE.add() • FHE.allowThis/Sender │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ Privara SDK (@reineira-os/sdk) │
│ • Cross-chain settlement • Escrow management • Finality │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Core Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| **Blockchain** | Arbitrum Sepolia (testnet) | Low-gas FHE-enabled L2 |
| **Encryption** | Fhenix CoFHE + FHE.sol | Fully Homomorphic Encryption |
| **Smart Contracts** | Solidity ^0.8.24 | FHE-enabled contract logic |
| **Client SDK** | @cofhe/sdk | Client-side encryption/decryption |
| **React Hooks** | @cofhe/react | Framework integration |
| **Settlement** | @reineira-os/sdk (Privara) | Cross-chain payment finality |
| **Dev Environment** | Hardhat + cofhe-hardhat-plugin | Local testing & deployment |
| **Mock Contracts** | cofhe-mock-contracts | Fast local FHE simulation |
| **Frontend** | Next.js 14 + Wagmi + RainbowKit | dApp UI |
| **AI Tooling** | reineira-code | Contract generation & audits |

### Supported Networks

- **Arbitrum Sepolia** — Primary testnet (lowest gas costs)[reference:6]
- **Base Sepolia** — Secondary testnet[reference:7]
- **Ethereum Sepolia** — Ethereum testnet[reference:8]

## Getting Started

### Prerequisites

- Node.js (v20 or later)
- pnpm (recommended package manager)[reference:9]
- MetaMask or similar Web3 wallet
- Testnet tokens (Sepolia ETH + USDC)

### Installation

```bash
# Clone the repository
git clone https://github.com/GauravKarakoti/confidro.git
cd confidro

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

### Environment Setup
```bash
# .env.example
PRIVATE_KEY=your_private_key_here
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
COORDINATOR_URL=https://coordinator.reineira.io
```

### Local Development
```bash
# Start local Hardhat network with FHE mocks
pnpm chain:start

# Deploy mock contracts
pnpm deploy:mock

# Run local node
pnpm dev
```

### Testing
```bash
# Run all tests with local FHE mocks
pnpm test

# Run specific test
pnpm test test/ConfidroPayroll.test.ts

# Run with coverage
pnpm test:coverage
```

### Deployment
```bash
# Deploy to Arbitrum Sepolia
pnpm deploy --network arbitrumSepolia

# Verify on Arbiscan
pnpm verify --network arbitrumSepolia <CONTRACT_ADDRESS>

# Deploy using reineira-code
npm run deploy
```

## Smart Contracts
### ConfidroPayroll.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract ConfidroPayroll {
    mapping(address => euint32) public salaries;  // Encrypted salary per employee
    euint32 public totalPayroll;                  // Encrypted total
    mapping(address => bool) public isCompliance; // Compliance officers
    
    event EmployeeAdded(address indexed employee, euint32 encryptedSalary);
    event PayrollProcessed(uint256 timestamp);
    
    function addEmployee(address employee, euint32 encryptedSalary) public onlyOwner {
        salaries[employee] = encryptedSalary;
        totalPayroll = FHE.add(totalPayroll, encryptedSalary);
        FHE.allowThis(totalPayroll);
        FHE.allowSender(totalPayroll);
        emit EmployeeAdded(employee, encryptedSalary);
    }
    
    function processPayroll() public onlyOwner {
        // Encrypted operations — amounts never decrypted
        // Total computed homomorphically
        
        // Settlement handled via Privara SDK
        _settlePayroll();
        
        emit PayrollProcessed(block.timestamp);
    }
    
    function withdrawSalary() public {
        euint32 salary = salaries[msg.sender];
        require(FHE.decrypt(salary) > 0, "No salary to withdraw");
        
        // Transfer funds
        _transferFunds(msg.sender, salary);
        
        // Clear salary after withdrawal
        delete salaries[msg.sender];
    }
}
```

### Key FHE Operations
| Operation | Function | Use Case |
|-----------|----------|----------|
| Encrypted addition | FHE.add(a, b) | Accumulating payroll totals |
| Encrypted comparison | FHE.lt(a, b) | Treasury sufficiency checks |
| Access control | FHE.allowThis() | Contract access to encrypted values |
| Access control | FHE.allowSender() | User access to their own data |

## Client Integration
### React Component Example
```tsx
import { useEncrypt, useDecrypt } from '@cofhe/react';
import { useWriteContract } from 'wagmi';

export function PayrollForm() {
  const { encrypt, encryptedData, isEncrypting } = useEncrypt();
  const { writeContract } = useWriteContract();
  
  const handleSubmit = async (salary: number) => {
    // Encrypt salary client-side
    const encrypted = await encrypt(salary);
    
    // Submit to contract (still encrypted)
    writeContract({
      address: payrollAddress,
      abi: payrollAbi,
      functionName: 'addEmployee',
      args: [employeeAddress, encrypted]
    });
  };
  
  return (/* UI */);
}
```

### Privara Settlement Example
```typescript
import { ReineiraSDK } from '@reineira-os/sdk';

const sdk = ReineiraSDK.create({
  network: 'testnet',
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC,
  onFHEInit: (status) => console.log('FHE:', status)
});

// Create escrow for payroll settlement
const escrow = await sdk.escrow.create({
  amount: sdk.usdc(50000),
  owner: payrollContractAddress
});

// Fund with auto-approval
await escrow.fund(sdk.usdc(50000), { autoApprove: true });
```

## Security & Permissions
### Access Control Model
```text
┌─────────────────────────────────────────────────────────────┐
│                    Permission Matrix                         │
├─────────────────┬──────────────┬──────────────┬─────────────┤
│ Role            │ View Own     │ View Totals  │ View All    │
│                 │ Salary       │ (Aggregate)  │ Salaries    │
├─────────────────┼──────────────┼──────────────┼─────────────┤
│ Employee        │ ✅ (Permit)  │ ❌           │ ❌          │
├─────────────────┼──────────────┼──────────────┼─────────────┤
│ Compliance      │ ❌           │ ✅ (Permit)  │ ❌          │
├─────────────────┼──────────────┼──────────────┼─────────────┤
│ Auditor         │ ❌           │ ✅ (Permit)  │ ✅ (Court)  │
├─────────────────┼──────────────┼──────────────┼─────────────┤
│ Employer/Owner  │ ✅           │ ✅           │ ❌          │
└─────────────────┴──────────────┴──────────────┴─────────────┘
```

### Permit Management
```solidity
// Allow contract to access encrypted value
FHE.allowThis(encryptedValue);

// Allow transaction sender to access
FHE.allowSender(encryptedValue);

// Allow specific address (compliance officer)
FHE.allow(encryptedValue, complianceAddress);
```

## Roadmap
### ✅ Completed
- Core `ConfidroPayroll.sol` smart contract
- FHE integration with euint32 types
- Client-side encryption/decryption (@cofhe/sdk)
- Privara cross-chain settlement
- Test suite with local FHE mocks
- Deployment to Arbitrum Sepolia

### 🚧 In Progress
- Compliance dashboard with selective disclosure
- Multi-token support (USDC, USDT, DAI)
- Automated tax withholding resolvers
- Mobile SDK (React Native)

### 📅 Planned
- Wave 3 — DAO governance module for contributor payroll
- Wave 4 — ZK-proofs for regulatory reporting
- Wave 5 — Cross-chain payroll (Ethereum → Arbitrum → Base)

## Development Workflow
### Using reineira-code for Development
```bash
# Generate a new condition resolver
/new-resolver A resolver that verifies payroll tax withholding

# Audit your contract for security
/audit

# Generate SDK integration code
/integrate
```

## Acknowledgments
- Fhenix Team — For building the CoFHE coprocessor and making FHE accessible to Solidity developers
- Privara (ReineiraOS) — For cross-chain settlement infrastructure
- Zama — For FHE cryptography research and tooling
- ETHGlobal — For inspiring the sealed-bid auction patterns that influenced our encrypted comparison logic
- Awesome Fhenix — For curated resources and examples

## 📞 Contact & Support
- Documentation: [docs.fhenix.io](https://docs.fhenix.io/)
- Fhenix Discord: [Join Discord](https://discord.gg/fhenix)
- Privara Builder Support: [Telegram](https://t.me/ReineiraOS)
- GitHub Issues: [Submit an issue](https://github.com/GauravKarakoti/confidro/issues)

## ⚠️ Disclaimer
This software is provided for educational and testing purposes only. Do not use on mainnet with real funds without a complete security audit.

---

Built with ❤️ for the Fhenix Privacy-by-Design Buildathon
