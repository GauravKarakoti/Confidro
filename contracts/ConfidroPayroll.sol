// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./ConfidroEscrow.sol";

interface IPrivaraEscrow {
    function distribute(address[] memory employees, euint64[] memory amounts, uint8[] memory currencies) external;
    function tokenETH() external view returns (address);
    function tokenUSDC() external view returns (address);
}

contract ConfidroPayroll {
    address public owner;
    
    mapping(address => euint64) public salaries;
    mapping(address => bool) public hasActiveSalary;
    mapping(address => uint8) public paymentCurrency; // 0 = ETH, 1 = USDC
    
    euint64 public totalPayrollETH;
    euint64 public totalPayrollUSDC;
    
    address[] public employeeList;
    
    // [FIX ADDED] Track compliance officers properly
    address[] public complianceList; 
    mapping(address => bool) public isCompliance;
    
    address public privaraEscrow;

    event EmployeeAdded(address indexed employee, euint64 encryptedSalary, uint8 currency);
    event PayrollProcessed(uint256 timestamp);
    event SalaryWithdrawn(address indexed employee, euint64 amount, uint8 currency);
    event ComplianceAdded(address indexed officer);
    event PrivaraEscrowSet(address indexed escrowAddress);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor(address _owner) {
        owner = _owner;

        totalPayrollETH = FHE.asEuint64(0);
        totalPayrollUSDC = FHE.asEuint64(0);
        
        FHE.allowThis(totalPayrollETH);
        FHE.allow(totalPayrollETH, owner);
        
        FHE.allowThis(totalPayrollUSDC);
        FHE.allow(totalPayrollUSDC, owner);
    }

    function deployAndSetEscrow(address tokenETH, address tokenUSDC) external onlyOwner {
        require(privaraEscrow == address(0), "Escrow already deployed");
        
        // Deploy the escrow directly from the payroll contract
        ConfidroEscrow newEscrow = new ConfidroEscrow(owner, address(this), tokenETH, tokenUSDC);
        
        // Set the state variable
        privaraEscrow = address(newEscrow);
        
        emit PrivaraEscrowSet(address(newEscrow));
    }

    function addCompliance(address officer) external onlyOwner {
        isCompliance[officer] = true;
        complianceList.push(officer); // [FIX ADDED] Add to tracking array
        
        FHE.allow(totalPayrollETH, officer);
        FHE.allow(totalPayrollUSDC, officer);
        
        emit ComplianceAdded(officer);
    }
    
    // currency: 0 for ETH, 1 for USDC
    function addEmployee(address employee, InEuint64 calldata encryptedSalaryInput, uint8 currency) public onlyOwner {
        require(currency == 0 || currency == 1, "Invalid currency");

        euint64 encryptedSalary = FHE.asEuint64(encryptedSalaryInput);
        FHE.allowThis(encryptedSalary);
        FHE.allow(encryptedSalary, owner);
        FHE.allow(encryptedSalary, employee);

        salaries[employee] = encryptedSalary;
        paymentCurrency[employee] = currency;
        hasActiveSalary[employee] = true;
        employeeList.push(employee);

        if (currency == 0) {
            totalPayrollETH = FHE.add(totalPayrollETH, encryptedSalary);
            FHE.allowThis(totalPayrollETH);
            FHE.allow(totalPayrollETH, owner);
        } else {
            totalPayrollUSDC = FHE.add(totalPayrollUSDC, encryptedSalary);
            FHE.allowThis(totalPayrollUSDC);
            FHE.allow(totalPayrollUSDC, owner);
        }
        
        for (uint i = 0; i < complianceList.length; i++) {
            FHE.allow(totalPayrollETH, complianceList[i]);
            FHE.allow(totalPayrollUSDC, complianceList[i]);
        }
        
        emit EmployeeAdded(employee, encryptedSalary, currency);
    }
    
    function processPayroll() public onlyOwner {
        emit PayrollProcessed(block.timestamp);

        if (privaraEscrow != address(0)) {
            euint64[] memory amounts = new euint64[](employeeList.length);
            uint8[] memory currencies = new uint8[](employeeList.length);
            
            // Fetch token addresses from the escrow
            address tETH = IPrivaraEscrow(privaraEscrow).tokenETH();
            address tUSDC = IPrivaraEscrow(privaraEscrow).tokenUSDC();

            for (uint i = 0; i < employeeList.length; i++) {
                address emp = employeeList[i];
                euint64 empSalary = salaries[emp];

                // 1. Allow the Escrow contract
                FHE.allow(empSalary, privaraEscrow);

                // 2. Allow the actual Token Wrapper contracts executing the transfer
                if (paymentCurrency[emp] == 0) {
                    FHE.allow(empSalary, tETH);
                } else {
                    FHE.allow(empSalary, tUSDC);
                }

                amounts[i] = empSalary;
                currencies[i] = paymentCurrency[emp];
            }
            IPrivaraEscrow(privaraEscrow).distribute(employeeList, amounts, currencies);
        }
    }

    function withdrawSalary() public {
        require(hasActiveSalary[msg.sender], "No salary to withdraw");

        euint64 salary = salaries[msg.sender];
        uint8 currency = paymentCurrency[msg.sender];
        
        hasActiveSalary[msg.sender] = false;

        if (currency == 0) {
            totalPayrollETH = FHE.sub(totalPayrollETH, salary);
            FHE.allowThis(totalPayrollETH);
            FHE.allow(totalPayrollETH, owner);
        } else {
            totalPayrollUSDC = FHE.sub(totalPayrollUSDC, salary);
            FHE.allowThis(totalPayrollUSDC);
            FHE.allow(totalPayrollUSDC, owner);
        }

        // [FIX ADDED] Must re-allow compliance officers when someone withdraws
        for (uint i = 0; i < complianceList.length; i++) {
            FHE.allow(totalPayrollETH, complianceList[i]);
            FHE.allow(totalPayrollUSDC, complianceList[i]);
        }
        
        emit SalaryWithdrawn(msg.sender, salary, currency);
    }

    function getEncryptedTotals() public view returns (euint64 ethTotal, euint64 usdcTotal) {
        return (totalPayrollETH, totalPayrollUSDC);
    }

    function getEmployees() public view returns (address[] memory) {
        return employeeList;
    }
}