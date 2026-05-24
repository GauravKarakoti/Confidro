// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FHERC20Wrapper {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    uint8 public immutable decimals;

    mapping(address => euint64) internal _balances;
    mapping(address => mapping(address => uint256)) public allowances;

    // We removed the isWETH flag to treat all underlying assets as standard ERC20s.
    constructor(address _underlying, uint8 _decimals) {
        underlying = IERC20(_underlying);
        decimals = _decimals;
    }

    function wrap(uint256 amount) external {
        underlying.safeTransferFrom(msg.sender, address(this), amount);
        
        euint64 encryptedAmount = FHE.asEuint64(amount);
        if (FHE.isInitialized(_balances[msg.sender])) {
            _balances[msg.sender] = FHE.add(_balances[msg.sender], encryptedAmount);
        } else {
            _balances[msg.sender] = encryptedAmount;
        }
        
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    function unwrap(uint256 amount) external {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        
        ebool canUnwrap = FHE.lte(encryptedAmount, _balances[msg.sender]);
        
        euint64 amountToSubtract = FHE.select(canUnwrap, encryptedAmount, FHE.asEuint64(0));
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amountToSubtract);
        
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        // Safely transfer the underlying ERC20 (whether it's USDC, WETH, aWETH, or cuWETH)
        underlying.safeTransfer(msg.sender, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, euint64 amount) external {
        _transfer(msg.sender, to, amount);
    }

    function transfer(address to, uint256 amount) external {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        _transfer(msg.sender, to, encryptedAmount);
    }

    function transferFrom(address from, address to, uint256 amount) external {
        require(allowances[from][msg.sender] >= amount, "Insufficient wrapper allowance");
        allowances[from][msg.sender] -= amount;

        euint64 encryptedAmount = FHE.asEuint64(amount);
        _transfer(from, to, encryptedAmount);
    }

    function _transfer(address from, address to, euint64 amount) internal {
        // Ensure 'from' balance is initialized before passing to FHE.lte to prevent panic
        if (!FHE.isInitialized(_balances[from])) {
            _balances[from] = FHE.asEuint64(0);
        }

        ebool hasBalance = FHE.lte(amount, _balances[from]);
        euint64 amountToMove = FHE.select(hasBalance, amount, FHE.asEuint64(0));

        _balances[from] = FHE.sub(_balances[from], amountToMove);
        
        if (FHE.isInitialized(_balances[to])) {
            _balances[to] = FHE.add(_balances[to], amountToMove);
        } else {
            _balances[to] = amountToMove;
        }
        
        FHE.allowThis(_balances[from]);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[from], from);
        FHE.allow(_balances[to], to);
    }

    function getEncryptedBalance(address account) external view returns (euint64) {
        return _balances[account];
    }
}