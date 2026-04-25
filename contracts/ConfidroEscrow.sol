// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

// Interface for a Confidential FHE-enabled ERC20 Token (FHERC20)
interface IFHERC20 {
    function transfer(address to, euint64 amount) external;
    function transferFrom(address from, address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external;
}

contract ConfidroEscrow {
    address public owner;
    address public payrollContract;
    
    // FHERC20 tokens used for confidential payroll
    IFHERC20 public tokenETH;  
    IFHERC20 public tokenUSDC; 

    event DepositedNative(address indexed sender, uint256 amount);
    event DepositedTokens(address indexed sender, address token, uint256 amount);
    event TokensDistributed(uint256 count);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyPayroll() {
        require(msg.sender == payrollContract, "Only payroll contract can distribute");
        _;
    }

    // Initialize with both payment token addresses
    constructor(address _owner, address _payrollContract, address _tokenETH, address _tokenUSDC) {
        require(_owner != address(0), "Invalid owner");
        require(_payrollContract != address(0), "Invalid payroll contract");
        require(_tokenETH != address(0), "Invalid ETH token");
        require(_tokenUSDC != address(0), "Invalid USDC token");

        owner = _owner;
        payrollContract = _payrollContract;
        tokenETH = IFHERC20(_tokenETH);
        tokenUSDC = IFHERC20(_tokenUSDC);
    }

    // 1. Native ETH Deposit (Keeps a native buffer for gas abstraction or unwrapping mechanics)
    function depositNative() external payable {
        emit DepositedNative(msg.sender, msg.value);
    }

    // 2. Token Deposit: Employer deposits the budget
    // currency: 0 for ETH, 1 for USDC
    function depositTokens(uint256 amount, uint8 currency) external {
        require(amount > 0, "Amount must be greater than 0");
        require(currency == 0 || currency == 1, "Invalid currency");
        
        if (currency == 0) {
            tokenETH.transferFrom(msg.sender, address(this), amount);
            emit DepositedTokens(msg.sender, address(tokenETH), amount);
        } else {
            tokenUSDC.transferFrom(msg.sender, address(this), amount);
            emit DepositedTokens(msg.sender, address(tokenUSDC), amount);
        }
    }

    // 3. FHE Distribution: Called by ConfidroPayroll during processPayroll()
    function distribute(address[] memory employees, euint64[] memory amounts, uint8[] memory currencies) external onlyPayroll {
        require(employees.length == amounts.length && amounts.length == currencies.length, "Mismatched arrays");
        
        for (uint i = 0; i < employees.length; i++) {
            if (currencies[i] == 0) {
                tokenETH.transfer(employees[i], amounts[i]);
            } else {
                tokenUSDC.transfer(employees[i], amounts[i]);
            }
        }

        emit TokensDistributed(employees.length);
    }

    function withdrawNative(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");
    }

    // Withdraw remaining/excess Token budget
    function withdrawTokens(uint256 amount, uint8 currency) external onlyOwner {
        require(currency == 0 || currency == 1, "Invalid currency");
        if (currency == 0) {
            tokenETH.transfer(owner, amount);
        } else {
            tokenUSDC.transfer(owner, amount);
        }
    }
}