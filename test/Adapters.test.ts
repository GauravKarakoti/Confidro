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

    const MockERC20 = await ethers.getContractFactory("MockERC20");
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
      const MockCurvePool = await ethers.getContractFactory("MockCurvePool");
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
      // Now defaults to 18 to safely accommodate both 6-decimal USDC and 18-decimal WETH balances
      expect(await curveAdapter.decimals()).to.equal(18); 
    });

    it("should supply USDC to Curve pool and mint ccToken receipt tokens", async function () {
      const depositAmount = ethers.parseUnits("100", 6);

      // Approve adapter to take USDC (cast to any to bypass BaseContract TS error)
      await (usdcMock.connect(user) as any).approve(curveAdapter.target, depositAmount);

      // Call supply
      await expect((curveAdapter.connect(user) as any).supply(usdcMock.target, depositAmount))
        .to.emit(curveAdapter, "Transfer") // ERC20 mint event
        .withArgs(ethers.ZeroAddress, user.address, depositAmount);

      // Check user received ccToken receipt tokens
      expect(await curveAdapter.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should supply WETH to Curve pool and mint ccToken receipt tokens", async function () {
      const depositAmount = ethers.parseEther("100");

      // Approve adapter to take WETH
      await (wethMock.connect(user) as any).approve(curveAdapter.target, depositAmount);

      // Call supply with WETH
      await expect((curveAdapter.connect(user) as any).supply(wethMock.target, depositAmount))
        .to.emit(curveAdapter, "Transfer") // ERC20 mint event
        .withArgs(ethers.ZeroAddress, user.address, depositAmount);

      // Check user received ccToken receipt tokens
      expect(await curveAdapter.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should revert if supplying an unsupported asset", async function () {
      // Deploy a random token to simulate an unsupported asset (since WETH is supported now)
      const MockERC20 = await ethers.getContractFactory("MockERC20");
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

    beforeEach(async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const cUsdcMock = await MockERC20.deploy("Mock cUSDC", "cUSDC", 6);
      const cWethMock = await MockERC20.deploy("Mock cWETH", "cWETH", 18);
      const uniUsdcMock = await MockERC20.deploy("Mock uniUSDC", "uUSDC", 6);
      const uniWethMock = await MockERC20.deploy("Mock uniWETH", "uWETH", 18);

      // Deploy Compound Adapter
      const CompoundMasterAdapter = await ethers.getContractFactory("CompoundMasterAdapter");
      compAdapter = await CompoundMasterAdapter.deploy(
        usdcMock.target, wethMock.target, cUsdcMock.target, cWethMock.target
      );

      // Deploy Uniswap Master Adapter
      const UniswapMasterAdapter = await ethers.getContractFactory("UniswapMasterAdapter");
      uniMasterAdapter = await UniswapMasterAdapter.deploy(
        usdcMock.target, wethMock.target, uniUsdcMock.target, uniWethMock.target
      );
    });

    it("should deploy both Compound and Uniswap Master Adapters successfully", async function () {
      expect(await compAdapter.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await uniMasterAdapter.getAddress()).to.not.equal(ethers.ZeroAddress);
    });
  });
});