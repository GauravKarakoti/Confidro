// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface IPrivaraEscrow {
    function distribute(address[] memory employees, euint32[] memory amounts) external;
}

contract ConfidroPayroll {
    address public owner;
    mapping(address => euint32) public salaries;
    mapping(address => bool) public hasActiveSalary;
    euint32 public totalPayroll;
    address[] public employeeList;

    mapping(address => bool) public isCompliance;
    address public privaraEscrow;

    event EmployeeAdded(address indexed employee, euint32 encryptedSalary);
    event PayrollProcessed(uint256 timestamp);
    event SalaryWithdrawn(address indexed employee, euint32 amount);
    event ComplianceAdded(address indexed officer);
    event PrivaraEscrowSet(address indexed escrowAddress);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
        totalPayroll = FHE.asEuint32(0);
        FHE.allowThis(totalPayroll);
        FHE.allow(totalPayroll, owner);
    }

    function setPrivaraEscrow(address _escrow) external onlyOwner {
        privaraEscrow = _escrow;
        emit PrivaraEscrowSet(_escrow);
    }

    function addCompliance(address officer) external onlyOwner {
        isCompliance[officer] = true;
        // GRANT PERMISSION: Instead of sealing, we allow the officer to decrypt the total.
        FHE.allow(totalPayroll, officer);
        emit ComplianceAdded(officer);
    }

    // This function now simply returns the ciphertext. 
    // The Compliance Officer's frontend will use their Permit to decrypt it.
    function getTotalForCompliance() public view returns (euint32) {
        require(isCompliance[msg.sender], "Not authorized");
        return totalPayroll;
    }
    
    function addEmployee(address employee, InEuint32 calldata encryptedSalaryInput) public onlyOwner {
        euint32 encryptedSalary = FHE.asEuint32(encryptedSalaryInput);
        
        FHE.allowThis(encryptedSalary);
        FHE.allow(encryptedSalary, owner);
        FHE.allow(encryptedSalary, employee);

        salaries[employee] = encryptedSalary;
        hasActiveSalary[employee] = true;
        employeeList.push(employee);
        
        totalPayroll = FHE.add(totalPayroll, encryptedSalary);
        FHE.allowThis(totalPayroll);
        FHE.allow(totalPayroll, owner);
        
        // Re-apply compliance permissions to the new totalPayroll ciphertext handle
        // (In FHE, addition creates a new handle/hash)
        for (uint i = 0; i < employeeList.length; i++) {
            if (isCompliance[employeeList[i]]) {
                FHE.allow(totalPayroll, employeeList[i]);
            }
        }
        
        emit EmployeeAdded(employee, encryptedSalary);
    }
    
    function processPayroll() public onlyOwner {
        emit PayrollProcessed(block.timestamp);
        if (privaraEscrow != address(0)) {
            euint32[] memory amounts = new euint32[](employeeList.length);
            for (uint i = 0; i < employeeList.length; i++) {
                euint32 empSalary = salaries[employeeList[i]];
                FHE.allow(empSalary, privaraEscrow);
                amounts[i] = empSalary;
            }
            IPrivaraEscrow(privaraEscrow).distribute(employeeList, amounts);
        }
    }

    function withdrawSalary() public {
        require(hasActiveSalary[msg.sender], "No salary to withdraw");
        euint32 salary = salaries[msg.sender];
        hasActiveSalary[msg.sender] = false;
        totalPayroll = FHE.sub(totalPayroll, salary);
        
        FHE.allowThis(totalPayroll);
        FHE.allow(totalPayroll, owner);
        emit SalaryWithdrawn(msg.sender, salary);
    }

    // --- RESTORED GETTERS REQUIRED BY TESTS AND FRONTEND ---

    function getEncryptedTotal() public view returns (euint32) {
        return totalPayroll;
    }

    function getEmployees() public view returns (address[] memory) {
        return employeeList;
    }
}