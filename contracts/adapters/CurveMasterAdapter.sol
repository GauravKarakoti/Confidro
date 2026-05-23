// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Standard OpenZeppelin import (ensure you have @openzeppelin/contracts installed)
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICurvePool {
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256);
}

contract CurveMasterAdapter is ERC20 {
    address public usdc;
    address public curvePool;

    // Issue receipt tokens: "Confidro Curve USDC"
    constructor(address _usdc, address _curvePool) ERC20("Confidro Curve USDC Receipt", "ccUSDC") {
        usdc = _usdc;
        curvePool = _curvePool;
    }

    // Override decimals to match USDC (6 decimals) instead of the default 18
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function supply(address asset, uint256 amount) external {
        require(asset == usdc, "Unsupported asset");
        
        // 1. Transfer the USDC from the caller (ConfidroEscrow) to this adapter
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        // 2. Approve the actual Curve pool to spend the adapter's USDC
        IERC20(asset).approve(curvePool, amount);
        
        // 3. Set up the deposit array (assuming a standard 2-pool where USDC is index 0)
        uint256[2] memory amounts;
        amounts[0] = amount; 
        amounts[1] = 0;

        // 4. Deposit into the Curve pool (min_mint_amount set to 0 for simplicity/testing)
        ICurvePool(curvePool).add_liquidity(amounts, 0);

        // 5. Mint 1:1 receipt tokens back to the caller so the FHE Wrapper can wrap them
        _mint(msg.sender, amount);
    }
}