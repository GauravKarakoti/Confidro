// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IComet {
    function supplyTo(address dst, address asset, uint amount) external;
}

contract CompoundMasterAdapter {
    address public immutable usdc;
    address public immutable weth;
    address public immutable cUSDCv3;
    address public immutable cWETHv3;

    constructor(address _usdc, address _weth, address _cUSDCv3, address _cWETHv3) {
        usdc = _usdc;
        weth = _weth;
        cUSDCv3 = _cUSDCv3;
        cWETHv3 = _cWETHv3;
    }

    function supply(address asset, uint256 amount) external {
        // 1. Pull the asset (USDC or WETH) from ConfidroEscrow
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        // 2. Route to the correct Compound V3 market
        // supplyTo() deposits the tokens and mints the yield-bearing cTokens directly to the Escrow
        if (asset == usdc) {
            IERC20(asset).approve(cUSDCv3, amount);
            IComet(cUSDCv3).supplyTo(msg.sender, asset, amount);
        } else if (asset == weth) {
            IERC20(asset).approve(cWETHv3, amount);
            IComet(cWETHv3).supplyTo(msg.sender, asset, amount);
        } else {
            revert("Unsupported asset");
        }
    }
}