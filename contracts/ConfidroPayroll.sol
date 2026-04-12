// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract ConfidroPayroll {
    // Contract owner (employer) who deploys the contract
    address public owner;

    // Encrypted salary per employee (wallet -> encrypted uint32)
    mapping(address => euint32) public salaries;
    
    // Plaintext mapping to track active employees to save gas on empty withdrawals
    mapping(address => bool) public hasActiveSalary;
    
    // Encrypted total payroll accumulator
    euint32 public totalPayroll;
    address[] public employeeList;
    
    // Events
    event EmployeeAdded(address indexed employee, euint32 encryptedSalary);
    event PayrollProcessed(uint256 timestamp);
    event SalaryWithdrawn(address indexed employee, euint32 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        // Set the deployer as the owner
        owner = msg.sender;
    }
    
    function addEmployee(address employee, InEuint32 calldata encryptedSalaryInput) public onlyOwner {
        // Convert the input struct into a trusted euint32
        euint32 encryptedSalary = FHE.asEuint32(encryptedSalaryInput);
        
        // Grant permissions for the individual salary ciphertext
        FHE.allowThis(encryptedSalary);
        
        // Allow the owner to read the initial encrypted salary (optional, but useful for admin dashboards)
        FHE.allow(encryptedSalary, owner); 
        
        // Explicitly allow the employee to decrypt their OWN salary
        FHE.allow(encryptedSalary, employee);
        
        // Store encrypted salary and mark as active
        salaries[employee] = encryptedSalary;
        hasActiveSalary[employee] = true;

        employeeList.push(employee);
        
        // Add to total payroll using FHE addition
        totalPayroll = FHE.add(totalPayroll, encryptedSalary);
        
        // Allow contract to access the updated total
        FHE.allowThis(totalPayroll);
        
        // SECURE: Explicitly grant access to the owner, regardless of who msg.sender is
        FHE.allow(totalPayroll, owner);
        
        emit EmployeeAdded(employee, encryptedSalary);
    }
    
    // Process payroll
    function processPayroll() public onlyOwner {
        emit PayrollProcessed(block.timestamp);
    }

    function getEmployees() public view returns (address[] memory) {
        return employeeList;
    }
    
    // Employee withdraws their salary
    function withdrawSalary() public {
        require(hasActiveSalary[msg.sender], "No salary to withdraw");
        
        euint32 salary = salaries[msg.sender];
        
        hasActiveSalary[msg.sender] = false;
                
        // Recompute totalPayroll homomorphically (subtract salary)
        totalPayroll = FHE.sub(totalPayroll, salary);
        
        FHE.allowThis(totalPayroll);
        
        // SECURE: Grant the owner permission to read the NEW totalPayroll ciphertext.
        // If we used FHE.allowSender here, the employee (msg.sender) would gain access
        // to the total payroll, and the owner would lose it.
        FHE.allow(totalPayroll, owner);
        
        emit SalaryWithdrawn(msg.sender, salary);
    }
    
    // Return the encrypted total.
    function getEncryptedTotal() public view returns (euint32) {
        return totalPayroll;
    }
}