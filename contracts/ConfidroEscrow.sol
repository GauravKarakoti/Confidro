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

// Updated interface to include wrapping logic and underlying asset fetch
interface IFHERC20Wrapper {
    function transfer(address to, euint64 amount) external;
    function transferFrom(address from, address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external;
    
    // Wrapper specific functions
    function wrap(uint256 amount) external;
    function unwrap(uint256 amount) external;
    function underlying() external view returns (address);
}

contract ConfidroEscrow {
    address public owner;
    address public payrollContract;

    // FHERC20 tokens used for confidential payroll
    IFHERC20Wrapper public tokenETH;  
    IFHERC20Wrapper public tokenUSDC;

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

    constructor(address _owner, address _payrollContract, address _tokenETH, address _tokenUSDC) {
        require(_owner != address(0), "Invalid owner");
        require(_payrollContract != address(0), "Invalid payroll contract");
        require(_tokenETH != address(0), "Invalid ETH token");
        require(_tokenUSDC != address(0), "Invalid USDC token");

        owner = _owner;
        payrollContract = _payrollContract;
        tokenETH = IFHERC20Wrapper(_tokenETH);
        tokenUSDC = IFHERC20Wrapper(_tokenUSDC);
    }

    // Currency: 0 for ETH, 1 for USDC
    // Now marked payable to accept native Base Sepolia ETH
    function depositTokens(uint256 amount, uint8 currency) external payable {
        require(amount > 0, "Amount must be greater than 0");
        require(currency == 0 || currency == 1, "Invalid currency");
        
        if (currency == 0) {
            // 1. Verify native ETH was sent
            require(msg.value == amount, "Incorrect ETH value sent");

            // 2. Wrap Native ETH -> WETH
            address weth = tokenETH.underlying();
            IWETH(weth).deposit{value: amount}();

            // 3. Approve FHERC20Wrapper to spend WETH
            IERC20(weth).approve(address(tokenETH), amount);

            // 4. Wrap WETH -> Encrypted FHE ETH
            tokenETH.wrap(amount);

            emit DepositedNative(msg.sender, amount);
        } else {
            // 1. Verify no native ETH was accidentally sent with a USDC transaction
            require(msg.value == 0, "Native ETH sent with USDC deposit");

            address standardUSDC = tokenUSDC.underlying();

            // 2. Pull standard USDC from the employer to the Escrow
            IERC20(standardUSDC).transferFrom(msg.sender, address(this), amount);

            // 3. Approve FHERC20Wrapper to spend standard USDC
            IERC20(standardUSDC).approve(address(tokenUSDC), amount);

            // 4. Wrap Standard USDC -> Encrypted FHE USDC
            tokenUSDC.wrap(amount);

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

    // FHE Distribution: Called by ConfidroPayroll during processPayroll()
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
}