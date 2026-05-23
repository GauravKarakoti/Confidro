// contracts/mocks/MockFHEWrapper.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract MockFHEWrapper {
    address public underlyingToken;

    constructor(address _underlying) {
        underlyingToken = _underlying;
    }

    function underlying() external view returns (address) {
        return underlyingToken;
    }

    function wrap(uint256 amount) external {
        // Empty mock to prevent revert during deposit routing
    }

    function transfer(address to, euint64 amount) external {
        // Empty mock to prevent revert during withdraw/claim routing
    }
}