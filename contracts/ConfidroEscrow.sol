// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

// Interface for a Confidential FHE-enabled ERC20 Token (FHERC20)
// This allows the contract to transfer encrypted amounts directly.
interface IFHERC20 {
    function transfer(address to, euint32 amount) external;
    function transferFrom(address from, address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external;
}

contract ConfidroEscrow {
    address public owner;
    address public payrollContract;
    IFHERC20 public paymentToken; // The FHERC20 token used for confidential payroll

    event DepositedNative(address indexed sender, uint256 amount);
    event DepositedTokens(address indexed sender, uint256 amount);
    event TokensDistributed(uint256 count);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyPayroll() {
        require(msg.sender == payrollContract, "Only payroll contract can distribute");
        _;
    }

    // Initialize with the payroll token address (e.g., a Confidential Stablecoin)
    constructor(address _owner, address _payrollContract, address _paymentToken) {
        require(_owner != address(0), "Invalid owner");
        require(_payrollContract != address(0), "Invalid payroll contract");
        require(_paymentToken != address(0), "Invalid payment token");

        owner = _owner;
        payrollContract = _payrollContract;
        paymentToken = IFHERC20(_paymentToken);
    }

    // 1. Native ETH Deposit (Optional: Keeps a native buffer for gas abstraction or future mechanics)
    function depositNative() external payable {
        emit DepositedNative(msg.sender, msg.value);
    }

    // 2. Token Deposit: Employer deposits the budget using standard public amounts
    // NOTE: The employer must call `approve()` on the FHERC20 token contract first
    function depositTokens(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        paymentToken.transferFrom(msg.sender, address(this), amount);
        emit DepositedTokens(msg.sender, amount);
    }

    // 3. FHE Distribution: Called by ConfidroPayroll during processPayroll()
    function distribute(address[] memory employees, euint32[] memory amounts) external onlyPayroll {
        require(employees.length == amounts.length, "Mismatched arrays");

        for (uint i = 0; i < employees.length; i++) {
            // EXECUTING ACTUAL ENCRYPTED TRANSFER
            // The FHERC20 contract homomorphically subtracts the encrypted amount from 
            // the Escrow's balance and adds it to the employee's balance.
            paymentToken.transfer(employees[i], amounts[i]);
        }

        emit TokensDistributed(employees.length);
    }

    // Withdraw remaining/excess Native budget
    function withdrawNative(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        payable(owner).transfer(amount);
    }

    // Withdraw remaining/excess Token budget
    function withdrawTokens(uint256 amount) external onlyOwner {
        paymentToken.transfer(owner, amount);
    }
}