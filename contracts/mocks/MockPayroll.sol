// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface IConfidroEscrow {
    function distribute(address[] memory employees, euint64[] memory amounts, uint8[] memory currencies) external;
}

contract MockPayroll {
    address public tokenETH;
    address public tokenUSDC;

    function setTokens(address _tokenETH, address _tokenUSDC) external {
        tokenETH = _tokenETH;
        tokenUSDC = _tokenUSDC;
    }

    // Takes standard uint256 amounts, wraps them into valid FHE euint64 handles, and forwards to Escrow
    function executeDistribute(
        address escrow, 
        address[] memory employees, 
        uint256[] memory amounts, 
        uint8[] memory currencies
    ) external {
        euint64[] memory encAmounts = new euint64[](amounts.length);
        
        for (uint i = 0; i < amounts.length; i++) {
            euint64 encAmount = FHE.asEuint64(amounts[i]); // Generate valid on-chain FHE handles
            
            // CRITICAL: Grant permission to the respective wrapper contracts so they can perform FHE math
            if (currencies[i] == 0) {
                FHE.allow(encAmount, tokenETH);
            } else {
                FHE.allow(encAmount, tokenUSDC);
            }
            
            encAmounts[i] = encAmount;
        }
        
        IConfidroEscrow(escrow).distribute(employees, encAmounts, currencies);
    }
}