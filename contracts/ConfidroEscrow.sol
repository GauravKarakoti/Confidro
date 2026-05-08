// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

// Interfaces for standard ERC20 and WETH
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint wad) external;
}

// Aave V3 Pool Interface
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

interface IFHERC20Wrapper {
    function transfer(address to, euint64 amount) external;
    function transfer(address to, uint256 amount) external; // [FIX ADDED] Add the uint256 overload back
    function wrap(uint256 amount) external;
    function underlying() external view returns (address); // This will return the aToken address
}

contract ConfidroEscrow {
    address public owner;
    address public payrollContract;
    IAavePool public aavePool;

    // Base tokens before Aave routing
    address public wethAddress;
    address public usdcAddress;

    // FHERC20 tokens used for confidential payroll (Wrapping aWETH and aUSDC)
    IFHERC20Wrapper public tokenETH;  
    IFHERC20Wrapper public tokenUSDC;
    
    euint64 public budgetETH;
    euint64 public budgetUSDC;

    event DepositedNative(address indexed sender, uint256 amount);
    event DepositedTokens(address indexed sender, address token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyPayroll() {
        require(msg.sender == payrollContract, "Only payroll contract can distribute");
        _;
    }

    constructor(
        address _owner, 
        address _payrollContract, 
        address _tokenETH, 
        address _tokenUSDC, 
        address _aavePool,
        address _wethAddress,
        address _usdcAddress
    ) {
        owner = _owner;
        payrollContract = _payrollContract;
        tokenETH = IFHERC20Wrapper(_tokenETH);
        tokenUSDC = IFHERC20Wrapper(_tokenUSDC);
        aavePool = IAavePool(_aavePool);
        wethAddress = _wethAddress;
        usdcAddress = _usdcAddress;
        
        budgetETH = FHE.asEuint64(0);
        FHE.allowThis(budgetETH);
        FHE.allow(budgetETH, _owner);
        
        budgetUSDC = FHE.asEuint64(0);
        FHE.allowThis(budgetUSDC); 
        FHE.allow(budgetUSDC, _owner);
    }

    // YIELD GENERATION + MULTICURRENCY
    function depositTokens(uint256 amount, uint8 currency) external payable {
        require(amount > 0, "Amount must be greater than 0");
        require(currency == 0 || currency == 1, "Invalid currency");
        
        if (currency == 0) {
            // 1. Verify native ETH was sent
            require(msg.value == amount, "Incorrect ETH value sent");

            // 2. Wrap Native ETH -> WETH
            IWETH(wethAddress).deposit{value: amount}();

            // 3. Supply WETH to Aave to mint aWETH (Yield generation begins)
            IERC20(wethAddress).approve(address(aavePool), amount);
            aavePool.supply(wethAddress, amount, address(this), 0);

            // 4. Wrap the yield-bearing aWETH into encrypted FHERC20 token
            address aWETH = tokenETH.underlying();
            IERC20(aWETH).approve(address(tokenETH), amount);
            tokenETH.wrap(amount);
            
            budgetETH = FHE.add(budgetETH, FHE.asEuint64(amount));
            FHE.allowThis(budgetETH); 
            FHE.allow(budgetETH, owner);

            emit DepositedNative(msg.sender, amount);

        } else {
            // 1. Verify no native ETH was accidentally sent with a USDC transaction
            require(msg.value == 0, "Native ETH sent with USDC deposit");

            // 2. Pull standard USDC from the employer to the Escrow
            IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount);

            // 3. Supply USDC to Aave to mint aUSDC
            IERC20(usdcAddress).approve(address(aavePool), amount);
            aavePool.supply(usdcAddress, amount, address(this), 0);

            // 4. Wrap the yield-bearing aUSDC into encrypted FHERC20 token
            address aUSDC = tokenUSDC.underlying();
            IERC20(aUSDC).approve(address(tokenUSDC), amount);
            tokenUSDC.wrap(amount);
            
            budgetUSDC = FHE.add(budgetUSDC, FHE.asEuint64(amount));
            FHE.allowThis(budgetUSDC); 
            FHE.allow(budgetUSDC, owner);

            emit DepositedTokens(msg.sender, address(tokenUSDC), amount);
        }
    }

    function withdrawTokens(uint256 amount, uint8 currency) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(currency == 0 || currency == 1, "Invalid currency");

        if (currency == 0) {
            tokenETH.transfer(msg.sender, amount);
        } else {
            tokenUSDC.transfer(msg.sender, amount);
        }
    }

    // Called dynamically by ConfidroPayroll's claimStream()
    function distribute(address employee, euint64 amount, uint8 currency) external onlyPayroll {
        if (currency == 0) {
            tokenETH.transfer(employee, amount);
            budgetETH = FHE.sub(budgetETH, amount);
            
            FHE.allowThis(budgetETH);
            FHE.allow(budgetETH, owner);
        } else {
            tokenUSDC.transfer(employee, amount);
            budgetUSDC = FHE.sub(budgetUSDC, amount);
            
            FHE.allowThis(budgetUSDC);
            FHE.allow(budgetUSDC, owner);
        }
    }
}