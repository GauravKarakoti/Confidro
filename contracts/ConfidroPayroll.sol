// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./ConfidroEscrow.sol";

interface IPrivaraEscrow {
    function distribute(address employee, euint64 amount, uint8 currency) external;
    function tokenETH() external view returns (address);
    function tokenUSDC() external view returns (address);
}

contract ConfidroPayroll {
    address public owner;
    
    // STREAMING + MULTICURRENCY SUPPORT
    mapping(address => euint64) public encryptedFlowRates; 
    mapping(address => uint256) public lastUpdateTimes;
    mapping(address => bool) public hasActiveSalary;
    mapping(address => uint8) public paymentCurrency; // 0 = ETH, 1 = USDC
    
    // Total aggregated flow rates per currency (Tokens per second)
    euint64 public totalFlowRateETH;
    euint64 public totalFlowRateUSDC;
    
    address[] public employeeList;
    address[] public complianceList; 
    mapping(address => bool) public isCompliance;
    
    address public privaraEscrow;

    // VIEW PERMITS
    struct ViewPermit {
        uint256 expiryTimestamp;
        bool isActive;
    }
    mapping(address => mapping(address => ViewPermit)) public viewPermits;

    event EmployeeAdded(address indexed employee, uint8 currency);
    event StreamClaimed(address indexed employee, uint256 timestamp);
    event ComplianceAdded(address indexed officer);
    event PrivaraEscrowSet(address indexed escrowAddress);
    event PermitGranted(address indexed employee, address indexed thirdParty, uint256 expiry);
    event PermitRevoked(address indexed employee, address indexed thirdParty);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor(address _owner) {
        owner = _owner;

        totalFlowRateETH = FHE.asEuint64(0);
        totalFlowRateUSDC = FHE.asEuint64(0);
        
        FHE.allowThis(totalFlowRateETH);
        FHE.allow(totalFlowRateETH, owner);
        
        FHE.allowThis(totalFlowRateUSDC);
        FHE.allow(totalFlowRateUSDC, owner);
    }

    function deployAndSetEscrow(
        address tokenETH, 
        address tokenUSDC, 
        address aavePool,
        address wethAddress,
        address usdcAddress
    ) external onlyOwner {
        require(privaraEscrow == address(0), "Escrow already deployed");
        ConfidroEscrow newEscrow = new ConfidroEscrow(
            owner, address(this), tokenETH, tokenUSDC, aavePool, wethAddress, usdcAddress
        );
        privaraEscrow = address(newEscrow);
        emit PrivaraEscrowSet(address(newEscrow));
    }

    function addCompliance(address officer) external onlyOwner {
        isCompliance[officer] = true;
        complianceList.push(officer); 
        
        FHE.allow(totalFlowRateETH, officer);
        FHE.allow(totalFlowRateUSDC, officer);
        
        emit ComplianceAdded(officer);
    }
    
    function addEmployee(address employee, InEuint64 calldata encryptedFlowRateInput, uint8 currency) public onlyOwner {
        require(currency == 0 || currency == 1, "Invalid currency");

        euint64 flowRate = FHE.asEuint64(encryptedFlowRateInput);
        FHE.allowThis(flowRate);
        FHE.allow(flowRate, owner);
        FHE.allow(flowRate, employee);

        encryptedFlowRates[employee] = flowRate;
        paymentCurrency[employee] = currency;
        hasActiveSalary[employee] = true;
        lastUpdateTimes[employee] = block.timestamp;
        employeeList.push(employee);

        if (currency == 0) {
            totalFlowRateETH = FHE.add(totalFlowRateETH, flowRate);
            FHE.allowThis(totalFlowRateETH);
            FHE.allow(totalFlowRateETH, owner);
        } else {
            totalFlowRateUSDC = FHE.add(totalFlowRateUSDC, flowRate);
            FHE.allowThis(totalFlowRateUSDC);
            FHE.allow(totalFlowRateUSDC, owner);
        }
        
        // Re-allow compliance officers
        for (uint i = 0; i < complianceList.length; i++) {
            FHE.allow(totalFlowRateETH, complianceList[i]);
            FHE.allow(totalFlowRateUSDC, complianceList[i]);
        }
        
        emit EmployeeAdded(employee, currency);
    }
    
    // Continuous streaming claim replacing the batch processing
    function claimStream() public {
        require(hasActiveSalary[msg.sender], "No active stream");
        require(privaraEscrow != address(0), "Escrow not deployed");

        uint256 timeDelta = block.timestamp - lastUpdateTimes[msg.sender];
        require(timeDelta > 0, "Too early to claim");

        euint64 streamedAmount = FHE.mul(encryptedFlowRates[msg.sender], FHE.asEuint64(timeDelta));
        FHE.allow(streamedAmount, privaraEscrow);
        
        uint8 curr = paymentCurrency[msg.sender];
        
        // Allow the actual Token Wrapper contracts executing the transfer
        address targetToken = curr == 0 
            ? IPrivaraEscrow(privaraEscrow).tokenETH() 
            : IPrivaraEscrow(privaraEscrow).tokenUSDC();
            
        FHE.allow(streamedAmount, targetToken);

        lastUpdateTimes[msg.sender] = block.timestamp;

        IPrivaraEscrow(privaraEscrow).distribute(msg.sender, streamedAmount, curr);
        emit StreamClaimed(msg.sender, block.timestamp);
    }

    // --- GRANULAR PERMISSIONS LOGIC ---

    function grantIncomeViewPermit(address thirdParty, uint256 durationInSeconds) external {
        require(hasActiveSalary[msg.sender], "No stream to prove");
        
        uint256 expiry = block.timestamp + durationInSeconds;
        viewPermits[msg.sender][thirdParty] = ViewPermit(expiry, true);
        
        FHE.allow(encryptedFlowRates[msg.sender], thirdParty);
        emit PermitGranted(msg.sender, thirdParty, expiry);
    }

    function revokeIncomeViewPermit(address thirdParty) external {
        viewPermits[msg.sender][thirdParty].isActive = false;
        emit PermitRevoked(msg.sender, thirdParty);
    }

    function verifyEmployeeIncome(address employee) external view returns (euint64) {
        ViewPermit memory permit = viewPermits[employee][msg.sender];
        require(permit.isActive, "Permit not active");
        require(block.timestamp < permit.expiryTimestamp, "Permit expired");
        
        return encryptedFlowRates[employee];
    }

    function getEncryptedTotals() public view returns (euint64 ethTotal, euint64 usdcTotal) {
        return (totalFlowRateETH, totalFlowRateUSDC);
    }

    function getEmployees() public view returns (address[] memory) {
        return employeeList;
    }
}