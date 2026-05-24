import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FheTypes } from "@cofhe/sdk";

describe("ConfidroEscrow", function () {
  let owner: HardhatEthersSigner;
  let employer: HardhatEthersSigner;
  let employee1: HardhatEthersSigner;
  let employee2: HardhatEthersSigner;

  let wethMock: any;
  let usdcMock: any;
  
  // Hoisted mock variables so we can assert their balances in the tests
  let aaveMock: any;
  let compMock: any;
  let uniMock: any;
  let curveMock: any;

  let yieldPools: any[] = [];
  let ethWrappers: any[] = [];
  let usdcWrappers: any[] = [];
  
  let escrow: any;
  let mockPayroll: any;

  beforeEach(async function () {
    [owner, employer, employee1, employee2] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();

    const MockERC20 = await ethers.getContractFactory("contracts/mocks/EscrowMocks.sol:MockERC20");
    usdcMock = await MockERC20.deploy("Mock USDC", "USDC", 6);
    
    const MockWETH = await ethers.getContractFactory("MockWETH");
    wethMock = await MockWETH.deploy();

    // 1. Deploy Mock aTokens
    const aWethMock = await MockERC20.deploy("Mock aWETH", "aWETH", 18);
    const aUsdcMock = await MockERC20.deploy("Mock aUSDC", "aUSDC", 6);

    // 2. Deploy Yield Mocks
    const MockAavePool = await ethers.getContractFactory("contracts/mocks/MockAavePool.sol:MockAavePool");
    const MockGenericYieldPool = await ethers.getContractFactory("contracts/mocks/EscrowMocks.sol:MockGenericYieldPool");
    
    aaveMock = await MockAavePool.deploy();
    compMock = await MockGenericYieldPool.deploy();
    uniMock = await MockGenericYieldPool.deploy();
    curveMock = await MockGenericYieldPool.deploy();

    // Deploy simulated receipt tokens for the Master Adapters
    const cWethMock = await MockERC20.deploy("Mock cWETH", "cWETH", 18);
    const cUsdcMock = await MockERC20.deploy("Mock cUSDC", "cUSDC", 6);
    const uWethMock = await MockERC20.deploy("Mock uWETH", "uWETH", 18);
    const uUsdcMock = await MockERC20.deploy("Mock uUSDC", "uUSDC", 6);
    const crvWethMock = await MockERC20.deploy("Mock crvWETH", "crvWETH", 18);
    const crvUsdcMock = await MockERC20.deploy("Mock crvUSDC", "crvUSDC", 6);

    // 3. Initialize Reserves so the mock pools mint the correct receipt token back to Escrow
    await aaveMock.initReserve(usdcMock.target, aUsdcMock.target);
    await aaveMock.initReserve(wethMock.target, aWethMock.target);
    
    await compMock.initReserve(wethMock.target, cWethMock.target);
    await compMock.initReserve(usdcMock.target, cUsdcMock.target);
    await uniMock.initReserve(wethMock.target, uWethMock.target);
    await uniMock.initReserve(usdcMock.target, uUsdcMock.target);
    await curveMock.initReserve(wethMock.target, crvWethMock.target);
    await curveMock.initReserve(usdcMock.target, crvUsdcMock.target);
    
    yieldPools = [aaveMock.target, compMock.target, uniMock.target, curveMock.target];

    // FIX: Define the actual Receipt Tokens that the Wrappers will wrap dynamically
    const ethReceipts = [aWethMock.target, cWethMock.target, uWethMock.target, crvWethMock.target];
    const usdcReceipts = [aUsdcMock.target, cUsdcMock.target, uUsdcMock.target, crvUsdcMock.target];

    const MockFHEWrapper = await ethers.getContractFactory("MockFHEWrapper");
    
    ethWrappers = [];
    usdcWrappers = [];
    for (let i = 0; i < 4; i++) {
        const fEth = await MockFHEWrapper.deploy(ethReceipts[i]);
        const fUsdc = await MockFHEWrapper.deploy(usdcReceipts[i]);
        
        ethWrappers.push(fEth);
        usdcWrappers.push(fUsdc);
    }

    const MockPayroll = await ethers.getContractFactory("MockPayroll");
    mockPayroll = await MockPayroll.deploy();

    const ConfidroEscrow = await ethers.getContractFactory("ConfidroEscrow");
    escrow = await ConfidroEscrow.deploy(
        ownerAddress,
        mockPayroll.target,
        wethMock.target,
        usdcMock.target,
        yieldPools,                         
        ethWrappers.map(w => w.target),     
        usdcWrappers.map(w => w.target)     
    );
  });

  it("Should initialize successfully and set initial encrypted budgets to 0", async function () {
    expect(await escrow.owner()).to.equal(await owner.getAddress());
    expect(await escrow.wethAddress()).to.equal(wethMock.target);
    expect(await escrow.usdcAddress()).to.equal(usdcMock.target);

    const fheClient = await hre.cofhe.createClientWithBatteries(owner);
    const budgetETH = await escrow.budgetETH();
    const budgetUSDC = await escrow.budgetUSDC();
    
    const decryptedETH = await fheClient.decryptForView(budgetETH, FheTypes.Uint64).execute();
    const decryptedUSDC = await fheClient.decryptForView(budgetUSDC, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(0);
    expect(Number(decryptedUSDC)).to.equal(0);
  });

  it("Should handle USDC deposits natively and distribute them across 4 pools via balance measurement", async function () {
    const depositAmount = ethers.parseUnits("100", 6);
    const employerAddress = await employer.getAddress();

    await usdcMock.mint(employerAddress, depositAmount);
    await usdcMock.connect(employer).approve(escrow.target, depositAmount);

    // FIX: Cast to any to bypass BaseContract strict typing
    await expect((escrow.connect(employer) as any).depositTokens(depositAmount, 1))
      .not.to.be.reverted;

    // Verify a standard 25/25/25/25 split success
    expect(await usdcMock.balanceOf(aaveMock.target)).to.equal(ethers.parseUnits("25", 6));
    expect(await usdcMock.balanceOf(compMock.target)).to.equal(ethers.parseUnits("25", 6));
  });

  it("Should route Aave's allocation to Compound if Aave pool reverts (Testnet Fallback logic)", async function () {
    // FIX: Instead of a random EOA wallet, use a deployed contract that lacks the supply() method (like usdcMock). 
    // This satisfies Solidity's extcodesize check and forces a true execution revert that try/catch can handle.
    const failingAaveAddress = usdcMock.target; 
    
    const failingYieldPools = [failingAaveAddress, compMock.target, uniMock.target, curveMock.target];
    
    const ConfidroEscrow = await ethers.getContractFactory("ConfidroEscrow");
    const failingEscrow = await ConfidroEscrow.deploy(
        await owner.getAddress(),
        mockPayroll.target,
        wethMock.target,
        usdcMock.target,
        failingYieldPools,                         
        ethWrappers.map(w => w.target),     
        usdcWrappers.map(w => w.target)     
    );

    const depositAmount = ethers.parseUnits("100", 6);
    const employerAddress = await employer.getAddress();

    await usdcMock.mint(employerAddress, depositAmount);
    await usdcMock.connect(employer).approve(failingEscrow.target, depositAmount);

    // Ensure the deposit does NOT revert, because the try/catch protects it
    await expect((failingEscrow.connect(employer) as any).depositTokens(depositAmount, 1))
      .not.to.be.reverted;

    // Aave should have received 0, Compound gets its own 25% + Aave's 25% (50%), Uni/Curve get 25%
    expect(await usdcMock.balanceOf(compMock.target)).to.equal(ethers.parseUnits("50", 6));
    expect(await usdcMock.balanceOf(uniMock.target)).to.equal(ethers.parseUnits("25", 6));
    expect(await usdcMock.balanceOf(curveMock.target)).to.equal(ethers.parseUnits("25", 6));
  });

  it("Should allow the owner to withdraw wrapped ETH successfully", async function () {
    const withdrawAmount = ethers.parseEther("0.05");
    // FIX: Cast to any to bypass BaseContract strict typing
    await expect((escrow.connect(owner) as any).withdrawTokens(withdrawAmount, 0))
      .to.not.be.reverted;
  });

  it("Should revert if a non-owner tries to withdraw", async function () {
    const withdrawAmount = ethers.parseEther("0.05");
    // FIX: Cast to any to bypass BaseContract strict typing
    await expect((escrow.connect(employee1) as any).withdrawTokens(withdrawAmount, 0))
      .to.be.revertedWith("Only owner can call this");
  });
});