// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapAdapterVault is IERC20 {
    function supply(address asset, uint256 amount) external;
}

contract UniswapMasterAdapter {
    address public immutable usdc;
    address public immutable weth;
    address public immutable uniVaultUSDC;
    address public immutable uniVaultWETH;

    constructor(address _usdc, address _weth, address _uniVaultUSDC, address _uniVaultWETH) {
        usdc = _usdc;
        weth = _weth;
        uniVaultUSDC = _uniVaultUSDC;
        uniVaultWETH = _uniVaultWETH;
    }

    function supply(address asset, uint256 amount) external {
        // 1. Pull the asset (USDC or WETH) from ConfidroEscrow
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        // 2. Route to the correct Uniswap Adapter Vault and measure exact output
        if (asset == usdc) {
            uint256 balBefore = IERC20(uniVaultUSDC).balanceOf(address(this));
            
            IERC20(asset).approve(uniVaultUSDC, amount);
            IUniswapAdapterVault(uniVaultUSDC).supply(asset, amount);
            
            uint256 minted = IERC20(uniVaultUSDC).balanceOf(address(this)) - balBefore;
            IERC20(uniVaultUSDC).transfer(msg.sender, minted);
            
        } else if (asset == weth) {
            uint256 balBefore = IERC20(uniVaultWETH).balanceOf(address(this));
            
            IERC20(asset).approve(uniVaultWETH, amount);
            IUniswapAdapterVault(uniVaultWETH).supply(asset, amount);
            
            uint256 minted = IERC20(uniVaultWETH).balanceOf(address(this)) - balBefore;
            IERC20(uniVaultWETH).transfer(msg.sender, minted);
            
        } else {
            revert("Unsupported asset");
        }
    }
}