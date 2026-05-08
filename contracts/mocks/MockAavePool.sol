// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        // Silently accepts the deposit without reverting
    }
}