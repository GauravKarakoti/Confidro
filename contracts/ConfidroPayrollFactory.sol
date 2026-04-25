// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ConfidroPayroll.sol";
import "./ConfidroEscrow.sol";

contract ConfidroPayrollFactory {
    // Keep track of all deployed contracts for analytics/admin
    address[] public allPayrollContracts;
    
    // Map an employer's wallet to the contract(s) they have deployed
    mapping(address => address[]) public employerContracts;
    
    event OrganizationCreated(address indexed employer, address contractAddress);
    
    // Employer calls this function from your UI
    function createOrganization() public returns (address) {
        // Deploy a new ConfidroPayroll contract
        // We pass msg.sender so the employer becomes the owner
        ConfidroPayroll newPayroll = new ConfidroPayroll(msg.sender);
        address contractAddress = address(newPayroll);
        
        // Save to our on-chain registry
        allPayrollContracts.push(contractAddress);
        employerContracts[msg.sender].push(contractAddress);
        
        emit OrganizationCreated(msg.sender, contractAddress);
        
        return contractAddress;
    }

    function createEscrow(address payrollContract, address paymentTokenAddress) public returns (address) {
        ConfidroEscrow newEscrow = new ConfidroEscrow(msg.sender, payrollContract, paymentTokenAddress);
        return address(newEscrow);
    }
    
    // Helper for the UI to quickly fetch an employer's contracts
    function getContractsByEmployer(address employer) public view returns (address[] memory) {
        return employerContracts[employer];
    }
}