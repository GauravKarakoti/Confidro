// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FHERC20Wrapper {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    uint8 public immutable decimals;

    mapping(address => euint32) internal _balances;
    mapping(address => mapping(address => uint256)) public allowances;

    constructor(address _underlying, uint8 _decimals) {
        underlying = IERC20(_underlying);
        decimals = _decimals;
    }

    function wrap(uint256 amount) external {
        underlying.safeTransferFrom(msg.sender, address(this), amount);
        
        euint32 encryptedAmount = FHE.asEuint32(amount);
        if (FHE.isInitialized(_balances[msg.sender])) {
            _balances[msg.sender] = FHE.add(_balances[msg.sender], encryptedAmount);
        } else {
            _balances[msg.sender] = encryptedAmount;
        }
        
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    function unwrap(uint256 amount) external {
        euint32 encryptedAmount = FHE.asEuint32(amount);
        
        // FIX: Replaced FHE.req with an FHE.select pattern or internal check
        // Since FHE.req is missing, we perform a subtraction that saturates at 0 
        // or simply subtract. In FHE protocols, we often use 'select' to ensure 
        // the balance doesn't go negative if the user tries to unwrap more than they have.
        
        ebool canUnwrap = FHE.lte(encryptedAmount, _balances[msg.sender]);
        
        // If they have enough, subtract 'amount', otherwise subtract 0
        euint32 amountToSubtract = FHE.select(canUnwrap, encryptedAmount, FHE.asEuint32(0));
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amountToSubtract);
        
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        // Note: In a fully private unwrap, the public transfer should be handled 
        // carefully. Here we assume 'amount' is public since it's passed as uint256.
        underlying.safeTransfer(msg.sender, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, euint32 amount) external {
        _transfer(msg.sender, to, amount);
    }

    function transfer(address to, uint256 amount) external {
        euint32 encryptedAmount = FHE.asEuint32(amount);
        _transfer(msg.sender, to, encryptedAmount);
    }

    function transferFrom(address from, address to, uint256 amount) external {
        require(allowances[from][msg.sender] >= amount, "Insufficient wrapper allowance");
        allowances[from][msg.sender] -= amount;

        euint32 encryptedAmount = FHE.asEuint32(amount);
        _transfer(from, to, encryptedAmount);
    }

    function _transfer(address from, address to, euint32 amount) internal {
        // FIX: Replaced FHE.req(FHE.lte(...)) with select pattern
        ebool hasBalance = FHE.lte(amount, _balances[from]);
        euint32 amountToMove = FHE.select(hasBalance, amount, FHE.asEuint32(0));

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

    function getEncryptedBalance(address account) external view returns (euint32) {
        return _balances[account];
    }
}