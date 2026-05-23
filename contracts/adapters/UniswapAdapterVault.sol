// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }
    function mint(MintParams calldata params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

contract UniswapAdapterVault is ERC20 {
    ISwapRouter02 public immutable swapRouter;
    INonfungiblePositionManager public immutable positionManager;
    
    address public immutable underlyingAsset; // e.g., USDC
    address public immutable pairedAsset;     // e.g., WETH
    uint24 public constant poolFee = 3000;    // 0.3% Fee Tier

    constructor(
        string memory name, 
        string memory symbol,
        address _underlyingAsset,
        address _pairedAsset,
        address _router,
        address _positionManager
    ) ERC20(name, symbol) {
        underlyingAsset = _underlyingAsset;
        pairedAsset = _pairedAsset;
        swapRouter = ISwapRouter02(_router);
        positionManager = INonfungiblePositionManager(_positionManager);
    }

    function supply(address asset, uint256 amount) external {
        require(asset == underlyingAsset, "Wrong adapter vault for this asset");
        
        // 1. Pull the deposit from ConfidroEscrow
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        // 2. Split the deposit 50/50 to pair it
        uint256 halfAmount = amount / 2;

        // 3. Swap 50% into the paired asset via SwapRouter02
        IERC20(asset).approve(address(swapRouter), halfAmount);
        
        ISwapRouter02.ExactInputSingleParams memory swapParams = ISwapRouter02.ExactInputSingleParams({
            tokenIn: asset,
            tokenOut: pairedAsset,
            fee: poolFee,
            recipient: address(this),
            amountIn: halfAmount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        uint256 amountOut = swapRouter.exactInputSingle(swapParams);

        // 4. Sort tokens to match Uniswap V3's Token0/Token1 requirements
        address token0 = asset < pairedAsset ? asset : pairedAsset;
        address token1 = asset < pairedAsset ? pairedAsset : asset;
        
        uint256 amount0Desired = asset == token0 ? (amount - halfAmount) : amountOut;
        uint256 amount1Desired = asset == token1 ? (amount - halfAmount) : amountOut;

        // 5. Mint the NFT Liquidity Position 
        IERC20(token0).approve(address(positionManager), amount0Desired);
        IERC20(token1).approve(address(positionManager), amount1Desired);

        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: poolFee,
            tickLower: -887220, // Full range ticks for tickSpacing 60
            tickUpper: 887220,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this), // Vault holds the NFT securely
            deadline: block.timestamp + 300
        });

        positionManager.mint(mintParams);
        
        // 6. Issue ERC20 Receipt Tokens to the Escrow (which will then be wrapped into FHE)
        _mint(msg.sender, amount);
    }
}