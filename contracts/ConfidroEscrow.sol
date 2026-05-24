// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint wad) external;
}

// Generic Interfaces for Yield Protocols
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}
interface IGenericYieldPool {
    function supply(address asset, uint256 amount) external;
}

interface IFHERC20Wrapper {
    function transfer(address to, euint64 amount) external;
    function wrap(uint256 amount) external;
    function underlying() external view returns (address);
}

contract ConfidroEscrow {
    address public owner;
    address public payrollContract;

    address public wethAddress;
    address public usdcAddress;

    // Yield Protocol Contracts
    IAavePool public aavePool;
    IGenericYieldPool public compPool;
    IGenericYieldPool public uniPool;
    IGenericYieldPool public curvePool;

    struct YieldWrappers {
        IFHERC20Wrapper aave;
        IFHERC20Wrapper comp;
        IFHERC20Wrapper uni;
        IFHERC20Wrapper curve;
    }

    YieldWrappers public ethWrappers;
    YieldWrappers public usdcWrappers;
    
    euint64 public budgetETH;
    euint64 public budgetUSDC;

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
        address _wethAddress,
        address _usdcAddress,
        address[4] memory _yieldPools, // [Aave, Comp, Uni, Curve]
        address[4] memory _ethWrappers, 
        address[4] memory _usdcWrappers
    ) {
        owner = _owner;
        payrollContract = _payrollContract;
        wethAddress = _wethAddress;
        usdcAddress = _usdcAddress;

        aavePool = IAavePool(_yieldPools[0]);
        compPool = IGenericYieldPool(_yieldPools[1]);
        uniPool = IGenericYieldPool(_yieldPools[2]);
        curvePool = IGenericYieldPool(_yieldPools[3]);

        ethWrappers = YieldWrappers(
            IFHERC20Wrapper(_ethWrappers[0]), IFHERC20Wrapper(_ethWrappers[1]),
            IFHERC20Wrapper(_ethWrappers[2]), IFHERC20Wrapper(_ethWrappers[3])
        );

        usdcWrappers = YieldWrappers(
            IFHERC20Wrapper(_usdcWrappers[0]), IFHERC20Wrapper(_usdcWrappers[1]),
            IFHERC20Wrapper(_usdcWrappers[2]), IFHERC20Wrapper(_usdcWrappers[3])
        );

        budgetETH = FHE.asEuint64(0);
        FHE.allowThis(budgetETH);
        FHE.allow(budgetETH, _owner);
        
        budgetUSDC = FHE.asEuint64(0);
        FHE.allowThis(budgetUSDC); 
        FHE.allow(budgetUSDC, _owner);
    }

    function depositTokens(uint256 amount, uint8 currency) external payable {
        require(amount > 0, "Amount must be greater than 0");
        require(currency == 0 || currency == 1, "Invalid currency");
        
        uint256 splitAmount = amount / 4;
        address underlying = currency == 0 ? wethAddress : usdcAddress;
        YieldWrappers memory wrappers = currency == 0 ? ethWrappers : usdcWrappers;

        if (currency == 0) {
            require(msg.value == amount, "Incorrect ETH value sent");
            IWETH(wethAddress).deposit{value: amount}();
        } else {
            require(msg.value == 0, "Native ETH sent with USDC deposit");
            IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount);
        }

        // 1. Aave (with try/catch fallback to Compound)
        address aaveUnd = wrappers.aave.underlying();
        uint256 aaveBalBefore = IERC20(aaveUnd).balanceOf(address(this));
        IERC20(underlying).approve(address(aavePool), splitAmount);
        
        try aavePool.supply(underlying, splitAmount, address(this), 0) {
            uint256 aaveMinted = IERC20(aaveUnd).balanceOf(address(this)) - aaveBalBefore;
            IERC20(aaveUnd).approve(address(wrappers.aave), aaveMinted);
            wrappers.aave.wrap(aaveMinted);
        } catch {
            // Fallback: Aave cap reached or reverted. Revoke approval.
            IERC20(underlying).approve(address(aavePool), 0);
            
            // Route Aave's 25% share to Compound instead
            address compUndFb = wrappers.comp.underlying();
            uint256 compBalBeforeFb = IERC20(compUndFb).balanceOf(address(this));
            
            IERC20(underlying).approve(address(compPool), splitAmount);
            compPool.supply(underlying, splitAmount);
            
            uint256 compMintedFb = IERC20(compUndFb).balanceOf(address(this)) - compBalBeforeFb;
            IERC20(compUndFb).approve(address(wrappers.comp), compMintedFb);
            wrappers.comp.wrap(compMintedFb);
        }

        // 2. Compound (Processes its normal 25% allocation)
        address compUnd = wrappers.comp.underlying();
        uint256 compBalBefore = IERC20(compUnd).balanceOf(address(this));
        IERC20(underlying).approve(address(compPool), splitAmount);
        compPool.supply(underlying, splitAmount);
        uint256 compMinted = IERC20(compUnd).balanceOf(address(this)) - compBalBefore;
        IERC20(compUnd).approve(address(wrappers.comp), compMinted);
        wrappers.comp.wrap(compMinted);

        // 3. Uniswap 
        address uniUnd = wrappers.uni.underlying();
        uint256 uniBalBefore = IERC20(uniUnd).balanceOf(address(this));
        IERC20(underlying).approve(address(uniPool), splitAmount);
        uniPool.supply(underlying, splitAmount);
        uint256 uniMinted = IERC20(uniUnd).balanceOf(address(this)) - uniBalBefore;
        IERC20(uniUnd).approve(address(wrappers.uni), uniMinted);
        wrappers.uni.wrap(uniMinted);

        // 4. Curve
        address curveUnd = wrappers.curve.underlying();
        uint256 curveBalBefore = IERC20(curveUnd).balanceOf(address(this));
        IERC20(underlying).approve(address(curvePool), splitAmount);
        curvePool.supply(underlying, splitAmount);
        uint256 curveMinted = IERC20(curveUnd).balanceOf(address(this)) - curveBalBefore;
        IERC20(curveUnd).approve(address(wrappers.curve), curveMinted);
        wrappers.curve.wrap(curveMinted);

        if (currency == 0) {
            budgetETH = FHE.add(budgetETH, FHE.asEuint64(amount));
            FHE.allowThis(budgetETH); FHE.allow(budgetETH, owner);
        } else {
            budgetUSDC = FHE.add(budgetUSDC, FHE.asEuint64(amount));
            FHE.allowThis(budgetUSDC); FHE.allow(budgetUSDC, owner);
        }
    }

    function distribute(
        address employee, euint64 amount, uint8 currency,
        euint64 aaveWeight, euint64 compWeight, euint64 uniWeight, euint64 curveWeight
    ) external onlyPayroll {
        
        euint64 hundred = FHE.asEuint64(100);
        euint64 aaveAmount = FHE.div(FHE.mul(amount, aaveWeight), hundred);
        euint64 compAmount = FHE.div(FHE.mul(amount, compWeight), hundred);
        euint64 uniAmount = FHE.div(FHE.mul(amount, uniWeight), hundred);
        euint64 curveAmount = FHE.div(FHE.mul(amount, curveWeight), hundred);

        YieldWrappers memory wrappers = currency == 0 ? ethWrappers : usdcWrappers;

        if (currency == 0) {
            budgetETH = FHE.sub(budgetETH, amount);
            FHE.allowThis(budgetETH); FHE.allow(budgetETH, owner);
        } else {
            budgetUSDC = FHE.sub(budgetUSDC, amount);
            FHE.allowThis(budgetUSDC); FHE.allow(budgetUSDC, owner);
        }

        // FHE allowances and transfers for the distinct wrapper tokens
        FHE.allow(aaveAmount, address(wrappers.aave));
        wrappers.aave.transfer(employee, aaveAmount);

        FHE.allow(compAmount, address(wrappers.comp));
        wrappers.comp.transfer(employee, compAmount);

        FHE.allow(uniAmount, address(wrappers.uni));
        wrappers.uni.transfer(employee, uniAmount);

        FHE.allow(curveAmount, address(wrappers.curve));
        wrappers.curve.transfer(employee, curveAmount);
    }

    function withdrawTokens(uint256 amount, uint8 currency) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(currency == 0 || currency == 1, "Invalid currency");
        
        uint256 splitAmount = amount / 4;
        YieldWrappers memory wrappers = currency == 0 ? ethWrappers : usdcWrappers;

        if (currency == 0) {
            budgetETH = FHE.sub(budgetETH, FHE.asEuint64(amount));
            FHE.allowThis(budgetETH); FHE.allow(budgetETH, owner);
        } else {
            budgetUSDC = FHE.sub(budgetUSDC, FHE.asEuint64(amount));
            FHE.allowThis(budgetUSDC); FHE.allow(budgetUSDC, owner);
        }

        euint64 encSplitAmount = FHE.asEuint64(splitAmount);

        // Allow and transfer 25% from each distinct wrapper
        FHE.allow(encSplitAmount, address(wrappers.aave));
        wrappers.aave.transfer(msg.sender, encSplitAmount);

        FHE.allow(encSplitAmount, address(wrappers.comp));
        wrappers.comp.transfer(msg.sender, encSplitAmount);

        FHE.allow(encSplitAmount, address(wrappers.uni));
        wrappers.uni.transfer(msg.sender, encSplitAmount);

        FHE.allow(encSplitAmount, address(wrappers.curve));
        wrappers.curve.transfer(msg.sender, encSplitAmount);
    }
}