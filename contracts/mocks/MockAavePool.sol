// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Adjust this path if EscrowMocks.sol is in a different folder
import "./EscrowMocks.sol"; 

interface IERC20Aave {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
}

contract MockAavePool {
    // Maps underlying asset (e.g., WETH) to its corresponding aToken (e.g., aWETH)
    mapping(address => address) public aTokens;

    // Admin function to pair an underlying asset with its mock aToken
    function initReserve(address asset, address aToken) external {
        aTokens[asset] = aToken;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 /* referralCode */) external {
        address aToken = aTokens[asset];
        require(aToken != address(0), "Reserve not initialized in Mock Aave");

        // 1. Pull the underlying asset from the sender (e.g. WETH from Escrow)
        IERC20Aave(asset).transferFrom(msg.sender, address(this), amount);

        // 2. Mint the equivalent amount of aTokens directly to the specified address
        IERC20Aave(aToken).mint(onBehalfOf, amount);
    }
}