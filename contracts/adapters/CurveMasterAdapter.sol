// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Standard OpenZeppelin import (ensure you have @openzeppelin/contracts installed)
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICurvePool {
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256);
}

contract CurveMasterAdapter is ERC20 {
    address public immutable usdc;
    address public immutable weth;
    address public immutable curvePoolUSDC;
    address public immutable curvePoolWETH;

    // Issue generic receipt tokens: "Confidro Curve Receipt"
    constructor(
        address _usdc, 
        address _weth, 
        address _curvePoolUSDC, 
        address _curvePoolWETH
    ) ERC20("Confidro Curve Receipt", "ccToken") {
        usdc = _usdc;
        weth = _weth;
        curvePoolUSDC = _curvePoolUSDC;
        curvePoolWETH = _curvePoolWETH;
    }

    function supply(address asset, uint256 amount) external {
        require(asset == usdc || asset == weth, "Unsupported asset");

        // 1. Transfer the asset from the caller (ConfidroEscrow) to this adapter
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        uint256[2] memory amounts;
        uint256 mintedLpAmount;

        if (asset == usdc) {
            // USDC is at index 0
            amounts[0] = amount; 
            amounts[1] = 0;
            IERC20(asset).approve(curvePoolUSDC, amount);
            mintedLpAmount = ICurvePool(curvePoolUSDC).add_liquidity(amounts, 0);
            
        } else if (asset == weth) {
            // WETH is at index 1
            amounts[0] = 0;
            amounts[1] = amount;
            IERC20(asset).approve(curvePoolWETH, amount);
            mintedLpAmount = ICurvePool(curvePoolWETH).add_liquidity(amounts, 0);
        }

        // 3. Mint exact received LP equivalent back to the caller
        _mint(msg.sender, mintedLpAmount);
    }
}