// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks the Compound, Uniswap, and generic adapters expecting `supply(asset, amount)`
contract MockGenericYieldPool is ERC20 {
    constructor() ERC20("Mock Yield Pool", "mYP") {}
    
    function supply(address asset, uint256 amount) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount); // Mint receipt tokens
    }
}

// Mocks Aave V3 expecting `supply(asset, amount, onBehalfOf, referralCode)`
contract MockAavePool {
    function supply(address asset, uint256 amount, address /*onBehalfOf*/, uint16 /*referralCode*/) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
    }
}

// Mocks Curve expecting `add_liquidity(amounts, min_mint)`
contract MockCurvePool {
    function add_liquidity(uint256[2] memory amounts, uint256 /*min_mint_amount*/) external pure returns (uint256) {
        // Just return the combined amounts for the mock
        return amounts[0] + amounts[1];
    }
}