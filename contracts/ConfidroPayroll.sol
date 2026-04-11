// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ConfidroPayroll is Ownable {
    // Encrypted salary per employee (wallet -> encrypted uint32)
    mapping(address => euint32) public salaries;
    
    // Plaintext mapping to track active employees to save gas on empty withdrawals
    mapping(address => bool) public hasActiveSalary;
    
    // Encrypted total payroll accumulator
    euint32 public totalPayroll;
    
    // Events – note that we emit the encrypted value (safe)
    event EmployeeAdded(address indexed employee, euint32 encryptedSalary);
    event PayrollProcessed(uint256 timestamp);
    event SalaryWithdrawn(address indexed employee, euint32 amount);
    
    constructor() Ownable(msg.sender) {}
    
    function addEmployee(address employee, InEuint32 calldata encryptedSalaryInput) public onlyOwner {
        // Convert the input struct (which verifies the ZK proof) into a trusted euint32
        euint32 encryptedSalary = FHE.asEuint32(encryptedSalaryInput);
        
        // Store encrypted salary and mark as active
        salaries[employee] = encryptedSalary;
        hasActiveSalary[employee] = true;
        
        // Add to total payroll using FHE addition
        totalPayroll = FHE.add(totalPayroll, encryptedSalary);
        
        // Allow contract and caller to access the updated total
        FHE.allowThis(totalPayroll);
        FHE.allowSender(totalPayroll);
        
        emit EmployeeAdded(employee, encryptedSalary);
    }
    
    // Process payroll – in this MVP we just prepare for withdrawals
    function processPayroll() public onlyOwner {
        emit PayrollProcessed(block.timestamp);
    }
    
    // Employee withdraws their salary
    function withdrawSalary() public {
        // Check plaintext boolean instead of decrypting the salary
        require(hasActiveSalary[msg.sender], "No salary to withdraw");
        
        euint32 salary = salaries[msg.sender];
        
        // Mark as inactive to prevent double-withdrawals
        hasActiveSalary[msg.sender] = false;
                
        // Recompute totalPayroll homomorphically (subtract salary)
        totalPayroll = FHE.sub(totalPayroll, salary);
        FHE.allowThis(totalPayroll);
        FHE.allowSender(totalPayroll);
        
        emit SalaryWithdrawn(msg.sender, salary);
    }
    
    // Return the encrypted total. The authorized owner decrypts this client-side.
    function getEncryptedTotal() public view onlyOwner returns (euint32) {
        return totalPayroll;
    }
}