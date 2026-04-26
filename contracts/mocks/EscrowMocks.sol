// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// 1. Import FHE to get the euint64 type definition
import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Allowance exceeded");
        require(balanceOf[from] >= amount, "Balance exceeded");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockWETH is MockERC20 {
    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint wad) external {
        require(balanceOf[msg.sender] >= wad, "Balance exceeded");

        balanceOf[msg.sender] -= wad;

        (bool success, ) = payable(msg.sender).call{value: wad}("");
        require(success, "ETH transfer failed");
    }
}

contract MockFHERC20Wrapper {
    address public underlying;
    uint256 public wrapCalledAmount;

    constructor(address _underlying) {
        underlying = _underlying;
    }

    function wrap(uint256 amount) external {
        wrapCalledAmount = amount;
        MockERC20(underlying).transferFrom(msg.sender, address(this), amount);
    }

    function unwrap(uint256 amount) external {}

    function transfer(address to, uint256 amount) external {}
    
    // 2. Add the missing FHE specific transfer selector
    function transfer(address to, euint64 amount) external {} 
    
    function transferFrom(address from, address to, uint256 amount) external {}
}