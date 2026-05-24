# Confidro — Encrypted Streaming Payroll & Confidential Payment Protocol

[![Built with Fhenix](https://img.shields.io/badge/Built%20with-Fhenix-5A29E4)](https://fhenix.io)
[![Privara SDK](https://img.shields.io/badge/Privara-SDK-0A5C3E)](https://reineira.xyz)

**On-chain streaming payroll that keeps salaries private — because your team's earnings shouldn't be public ledger data.**

Confidro is a privacy-preserving payroll protocol that enables organizations to stream salaries fully on-chain with complete confidentiality. Using Fhenix's Fully Homomorphic Encryption (FHE), salary flow rates remain encrypted throughout computation. Employees can dynamically route their encrypted streams into DeFi yield protocols (Aave, Compound, Curve, Uniswap) without exposing their balances, and issue temporary, granular permits for income verification.

---

## 📖 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Smart Contracts](#smart-contracts)
- [Granular Permissions & Verifiable Income](#granular-permissions--verifiable-income)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Overview

Confidro solves two fundamental problems in on-chain finance: **transparent payroll** and **capital inefficiency**.

Public blockchains expose every transaction. When you pay employees in crypto, their exact salary becomes visible. Furthermore, standard payroll systems pay out bi-weekly, leaving capital idle. 

Confidro leverages **Fully Homomorphic Encryption (FHE)** via **Fhenix** and **Cross-chain Escrow** via **Privara** to enable:

- ✅ **Encrypted streaming salaries** — stored and streamed as `euint64` flow rates.
- ✅ **Multi-Currency Support** — stream in ETH or USDC.
- ✅ **Confidential Yield Routing** — opt-in automated yield generation routing directly into Aave, Compound, Uniswap, and Curve.
- ✅ **Verifiable Income** — employees can issue time-bound permits for third parties (like landlords or banks) to verify their encrypted income.
- ✅ **MEV protection** — encrypted mempool prevents front-running.
- ✅ **Institutional compliance** — aggregated totals for tax reporting without exposing individual data.

## Problem Statement

### The Transparency Tax & Idle Capital

Public blockchains made transparency the default, which created hard limits on what you can build. 

| Problem | Impact | Confidro Solution |
|---|---|---|
| **Public salaries** | Competitors poach top talent; employee morale suffers | Homomorphic encryption hides salary flow rates entirely. |
| **Capital Inefficiency**| Employees wait weeks for paychecks, missing out on DeFi yields | Streaming salaries + stealth auto-routing to Aave/Compound. |
| **Income Verification**| ZK proofs are complex and hard for traditional auditors to verify | Time-bound read permits generated via `grantIncomeViewPermit`. |

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

### Step-by-Step Flow

1. **Employer Setup** — Registers employee wallets, setting their currency (ETH/USDC) and encrypted flow rates (tokens per second).
2. **Encryption** — Values are encrypted client-side using `@cofhe/sdk`.
3. **Yield Configuration** — Employees set their target DeFi allocations (e.g., 50% Aave, 50% Curve) via `updateYieldRouting()`.
4. **Continuous Streaming** — Salaries accrue in real-time. The contract computes amounts homomorphically based on elapsed time.
5. **Claim & Route** — Employee calls `claimStream()`. The `ConfidroEscrow` automatically splits and routes the claimed amount to the designated yield wrappers.
6. **Income Verification** — Employee generates a time-bound permit for a third party to decrypt their flow rate.

## Architecture
```text
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (Next.js + Wagmi + Groq SDK)                           │
│ • Dashboard • Yield Allocation Strategy • Permit Management     │
└─────────┼──────────────────┼─────────────────────┼──────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ @cofhe/sdk (Client SDK)                                         │
│ • Client-side encryption & decryption of flow rates / yields    │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ConfidroPayroll.sol (Core)                                      │
│ • streaming rates (euint64) • time delta math • view permits    │
└─────────┬────────────────────────────────────────┬──────────────┘
          │                                        │
          ▼                                        ▼
┌─────────────────────────┐              ┌─────────────────────────┐
│ ConfidroEscrow.sol      │              │ Privara SDK             │
│ • Yield Wrappers        │◀────────────▶│ • Escrow management     │
│ • Aave/Comp/Uni/Curve   │              │ • Cross-chain actions   │
└─────────────────────────┘              └─────────────────────────┘
```

## Tech Stack

### Core Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| **Blockchain** | Base Sepolia (testnet) | Low-gas FHE-enabled L2 |
| **Encryption** | Fhenix CoFHE + FHE.sol | Fully Homomorphic Encryption |
| **Smart Contracts** | Solidity ^0.8.24 | FHE-enabled contract logic |
| **Client SDK** | @cofhe/sdk | Client-side encryption/decryption |
| **DeFi Integrations** | Aave, Compound, Uniswap, Curve (via FHERC20Wrappers) | Yield Pools |
| **AI Processing** | Groq API | Ultra-fast reasoning for DeFi yield allocation |
| **Settlement** | @reineira-os/sdk (Privara) | Cross-chain payment finality |
| **Dev Environment** | Hardhat + cofhe-hardhat-plugin | Local testing & deployment |
| **Frontend** | Next.js 14 + Wagmi + RainbowKit | dApp UI |

### Supported Networks

- **Base Sepolia** — Primary testnet (lowest gas costs)

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
BASE_SEPOLIA_RPC_URL=https://sepolia-rollup.base.io/rpc
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
# Deploy to Base Sepolia
pnpm deploy --network baseSepolia

# Verify on Arbiscan
pnpm verify --network baseSepolia <CONTRACT_ADDRESS>
```

## Smart Contracts
### ConfidroPayroll.sol
The contract uses FHE to manage streaming payroll and yield allocations without decrypting the underlying values.
```solidity
import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract ConfidroPayroll {
    // STREAMING + MULTICURRENCY SUPPORT
    mapping(address => euint64) public encryptedFlowRates;
    mapping(address => uint256) public lastUpdateTimes;
    mapping(address => uint8) public paymentCurrency; // 0 = ETH, 1 = USDC

    // AI DEFI AGENT ROUTING STATE (0-100 Encrypted Percentages)
    mapping(address => euint64) public aaveAllocations;
    mapping(address => euint64) public compoundAllocations;
    mapping(address => euint64) public uniswapAllocations;
    mapping(address => euint64) public curveAllocations;

    // View Permits for Verifiable Income
    struct ViewPermit {
        uint256 expiryTimestamp;
        bool isActive;
    }
    mapping(address => mapping(address => ViewPermit)) public viewPermits;

    function claimStream() public {
        uint256 timeDelta = block.timestamp - lastUpdateTimes[msg.sender];
        euint64 streamedAmount = FHE.mul(encryptedFlowRates[msg.sender], FHE.asEuint64(timeDelta));
        
        // Pass stream to escrow for yield distribution
        IPrivaraEscrow(privaraEscrow).distribute(
            msg.sender, streamedAmount, paymentCurrency[msg.sender], 
            aaveAllocations[msg.sender], compoundAllocations[msg.sender], 
            uniswapAllocations[msg.sender], curveAllocations[msg.sender]
        );
    }
}
```

### Granular Permissions & Verifiable Income
Confidro replaces vulnerable plaintext income verification (e.g., sending bank statements to landlords) with Encrypted View Permits. Employees can grant specific third parties temporary access to decrypt their salary.
```solidity
// Employee generates a 30-day permit for a landlord/auditor
function grantIncomeViewPermit(address thirdParty, uint256 durationInSeconds) external {
    uint256 expiry = block.timestamp + durationInSeconds;
    viewPermits[msg.sender][thirdParty] = ViewPermit(expiry, true);
    
    FHE.allow(encryptedFlowRates[msg.sender], thirdParty);
}

// Auditor securely views the encrypted flow rate
function verifyEmployeeIncome(address employee) external view returns (euint64) {
    ViewPermit memory permit = viewPermits[employee][msg.sender];
    require(permit.isActive && block.timestamp < permit.expiryTimestamp, "Permit invalid");
    return encryptedFlowRates[employee];
}
```

### Key FHE Operations
| Operation | Function | Use Case |
|-----------|----------|----------|
| Encrypted addition | FHE.add(a, b) | Accumulating payroll totals |
| Encrypted comparison | FHE.lte(a, b) | Treasury sufficiency checks |
| Access control | FHE.allowThis() | Contract access to encrypted values |

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

// Allow specific address (compliance officer)
FHE.allow(encryptedValue, complianceAddress);
```

## Roadmap
### ✅ Completed
- Core ConfidroPayroll.sol and ConfidroEscrow.sol contracts.
- Streaming Payroll with dynamic time-delta calculation using FHE.
- Multi-token support (USDC, ETH).
- Automated Yield Routing into Aave, Compound, Uniswap, and Curve.
- Verifiable Income: Granular permission granting and revocation (grantIncomeViewPermit).
- Privara cross-chain settlement integration.
- Graph-Based Compliance Forensics: Anti-money laundering (AML) protections enabling anomaly detection on encrypted financial graphs.
- Autonomous Encrypted Agents (Powered by Groq) in the frontend for intelligent yield rebalancing.

### 🚀 Planned
#### Post Buildation
- DAO governance module for contributor payroll.
- ZK-proofs for regulatory reporting to complement FHE.
- Expansion to Arbitrum and Ethereum via Privara cross-chain messaging.

## Acknowledgments
- Fhenix Team — For building the CoFHE coprocessor and making FHE accessible to Solidity developers.
- Privara (ReineiraOS) — For cross-chain settlement infrastructure.

## 📞 Contact & Support
- Documentation: [docs.fhenix.io](https://docs.fhenix.io/)
- Fhenix Discord: [Join Discord](https://discord.gg/fhenix)
- Privara Builder Support: [Telegram](https://t.me/ReineiraOS)
- GitHub Issues: [Submit an issue](https://github.com/GauravKarakoti/confidro/issues)

## ⚠️ Disclaimer
This software is provided for educational and testing purposes only. Do not use on mainnet with real funds without a complete security audit.

---

Built with ❤️ for the Fhenix Privacy-by-Design Buildathon