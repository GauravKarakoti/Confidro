// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ConfidroPayroll is Ownable {
    // Encrypted salary per employee (wallet -> encrypted uint32)
    mapping(address => euint32) public salaries;
    
    // Encrypted total payroll accumulator
    euint32 public totalPayroll;
    
    // Events – note that we emit the encrypted value (safe)
    event EmployeeAdded(address indexed employee, euint32 encryptedSalary);
    event PayrollProcessed(uint256 timestamp);
    event SalaryWithdrawn(address indexed employee, euint32 amount);
    
    constructor() Ownable(msg.sender) {}
    
    // Add employee with encrypted salary (called by employer)
    function addEmployee(address employee, euint32 encryptedSalary) public onlyOwner {
        require(FHE.decrypt(encryptedSalary) > 0, "Salary must be > 0");
        
        // Store encrypted salary
        salaries[employee] = encryptedSalary;
        
        // Add to total payroll using FHE addition
        totalPayroll = FHE.add(totalPayroll, encryptedSalary);
        
        // Allow contract and caller to access the updated total
        FHE.allowThis(totalPayroll);
        FHE.allowSender(totalPayroll);
        
        emit EmployeeAdded(employee, encryptedSalary);
    }
    
    // Process payroll – in this MVP we just prepare for withdrawals
    // In later waves we'll integrate Privara settlement
    function processPayroll() public onlyOwner {
        // We'll just emit an event to simulate settlement
        // Actual transfer will happen in withdrawSalary()
        emit PayrollProcessed(block.timestamp);
    }
    
    // Employee withdraws their salary
    function withdrawSalary() public {
        euint32 salary = salaries[msg.sender];
        // Decrypt to check if >0 (gas cost but needed for UX)
        require(FHE.decrypt(salary) > 0, "No salary to withdraw");
        
        // Here you would transfer funds (e.g., USDC)
        // For MVP, we just clear the salary mapping
        delete salaries[msg.sender];
        
        // Recompute totalPayroll homomorphically (subtract salary)
        totalPayroll = FHE.sub(totalPayroll, salary);
        FHE.allowThis(totalPayroll);
        FHE.allowSender(totalPayroll);
        
        emit SalaryWithdrawn(msg.sender, salary);
    }
    
    // Helper to view decrypted total (only owner can decrypt)
    function getDecryptedTotal() public view onlyOwner returns (uint32) {
        return FHE.decrypt(totalPayroll);
    }
}