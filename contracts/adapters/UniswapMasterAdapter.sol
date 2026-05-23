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

        // 2. Route to the correct Uniswap Adapter Vault
        if (asset == usdc) {
            IERC20(asset).approve(uniVaultUSDC, amount);
            IUniswapAdapterVault(uniVaultUSDC).supply(asset, amount);
            
            // 3. The vault mints receipt tokens to this Master Adapter. 
            // Transfer them back to the Escrow so they can be wrapped.
            IERC20(uniVaultUSDC).transfer(msg.sender, amount);
        } else if (asset == weth) {
            IERC20(asset).approve(uniVaultWETH, amount);
            IUniswapAdapterVault(uniVaultWETH).supply(asset, amount);
            
            IERC20(uniVaultWETH).transfer(msg.sender, amount);
        } else {
            revert("Unsupported asset");
        }
    }
}