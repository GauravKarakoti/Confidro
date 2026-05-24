import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Master Yield Adapters", function () {
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let usdcMock: any;
  let wethMock: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("contracts/mocks/EscrowMocks.sol:MockERC20");
    usdcMock = await MockERC20.deploy("Mock USDC", "USDC", 6);
    wethMock = await MockERC20.deploy("Mock WETH", "WETH", 18);

    // Give user some tokens to test supplying
    await usdcMock.mint(user.address, ethers.parseUnits("1000", 6));
    await wethMock.mint(user.address, ethers.parseEther("1000"));
  });

  describe("CurveMasterAdapter", function () {
    let curvePoolMockUSDC: any;
    let curvePoolMockWETH: any;
    let curveAdapter: any;

    beforeEach(async function () {
      const MockCurvePool = await ethers.getContractFactory("contracts/mocks/YieldMocks.sol:MockCurvePool");
      // Deploy mock pools for both USDC and WETH routes
      curvePoolMockUSDC = await MockCurvePool.deploy();
      curvePoolMockWETH = await MockCurvePool.deploy();

      const CurveMasterAdapter = await ethers.getContractFactory("CurveMasterAdapter");
      curveAdapter = await CurveMasterAdapter.deploy(
        usdcMock.target, 
        wethMock.target, 
        curvePoolMockUSDC.target,
        curvePoolMockWETH.target
      );
    });

    it("should deploy as an ERC20 receipt token with standard 18 decimals", async function () {
      expect(await curveAdapter.symbol()).to.equal("ccToken");
      expect(await curveAdapter.decimals()).to.equal(18); 
    });

    it("should supply USDC to Curve pool and mint exact ccToken receipt tokens dynamically", async function () {
      const depositAmount = ethers.parseUnits("100", 6);

      await (usdcMock.connect(user) as any).approve(curveAdapter.target, depositAmount);

      await expect((curveAdapter.connect(user) as any).supply(usdcMock.target, depositAmount))
        .to.emit(curveAdapter, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, depositAmount);

      expect(await curveAdapter.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should supply WETH to Curve pool and mint exact ccToken receipt tokens dynamically", async function () {
      const depositAmount = ethers.parseEther("100");

      await (wethMock.connect(user) as any).approve(curveAdapter.target, depositAmount);

      await expect((curveAdapter.connect(user) as any).supply(wethMock.target, depositAmount))
        .to.emit(curveAdapter, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, depositAmount);

      expect(await curveAdapter.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should revert if supplying an unsupported asset", async function () {
      const MockERC20 = await ethers.getContractFactory("contracts/mocks/EscrowMocks.sol:MockERC20");
      const randomToken = (await MockERC20.deploy("Random", "RND", 18)) as any;
      await randomToken.mint(user.address, ethers.parseEther("10"));

      const depositAmount = ethers.parseEther("10");
      await (randomToken.connect(user) as any).approve(curveAdapter.target, depositAmount);

      await expect((curveAdapter.connect(user) as any).supply(randomToken.target, depositAmount))
        .to.be.revertedWith("Unsupported asset");
    });
  });

  describe("CompoundMasterAdapter & UniswapMasterAdapter", function () {
    let compAdapter: any;
    let uniMasterAdapter: any;
    let uniVaultUSDC: any;
    let uniVaultWETH: any;

    beforeEach(async function () {
      const MockERC20 = await ethers.getContractFactory("contracts/mocks/EscrowMocks.sol:MockERC20");
      const cUsdcMock = await MockERC20.deploy("Mock cUSDC", "cUSDC", 6);
      const cWethMock = await MockERC20.deploy("Mock cWETH", "cWETH", 18);
      
      // Use YieldMocks version because it acts as an ERC20 token that accepts deposits (perfectly mimics an ERC4626 vault)
      const MockVault = await ethers.getContractFactory("contracts/mocks/YieldMocks.sol:MockGenericYieldPool");
      uniVaultUSDC = await MockVault.deploy();
      uniVaultWETH = await MockVault.deploy();

      // Deploy Compound Adapter
      const CompoundMasterAdapter = await ethers.getContractFactory("CompoundMasterAdapter");
      compAdapter = await CompoundMasterAdapter.deploy(
        usdcMock.target, wethMock.target, cUsdcMock.target, cWethMock.target
      );

      // Deploy Uniswap Master Adapter
      const UniswapMasterAdapter = await ethers.getContractFactory("UniswapMasterAdapter");
      uniMasterAdapter = await UniswapMasterAdapter.deploy(
        usdcMock.target, wethMock.target, uniVaultUSDC.target, uniVaultWETH.target
      );
    });

    it("should route USDC to Uniswap Vault and return the exact minted vault tokens via dynamic balance check", async function () {
      const depositAmount = ethers.parseUnits("100", 6);
      
      // User approves Master Adapter
      await (usdcMock.connect(user) as any).approve(uniMasterAdapter.target, depositAmount);
      
      // Supply
      await (uniMasterAdapter.connect(user) as any).supply(usdcMock.target, depositAmount);
      
      // The Master adapter transferred the dynamically measured yield tokens safely back to the user
      expect(await uniVaultUSDC.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should route WETH to Uniswap Vault and return the exact minted vault tokens via dynamic balance check", async function () {
      const depositAmount = ethers.parseEther("100");
      
      await (wethMock.connect(user) as any).approve(uniMasterAdapter.target, depositAmount);
      await (uniMasterAdapter.connect(user) as any).supply(wethMock.target, depositAmount);
      
      expect(await uniVaultWETH.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should deploy Compound Master Adapter successfully", async function () {
      expect(await compAdapter.getAddress()).to.not.equal(ethers.ZeroAddress);
    });
  });
});