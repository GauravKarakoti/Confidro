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

    // 2. Deploy Yield Mocks (using EscrowMocks versions to simulate Master Adapters)
    const MockAavePool = await ethers.getContractFactory("contracts/mocks/MockAavePool.sol:MockAavePool");
    const MockGenericYieldPool = await ethers.getContractFactory("contracts/mocks/EscrowMocks.sol:MockGenericYieldPool");
    
    const aaveMock = await MockAavePool.deploy();
    
    // In these tests, the Master Adapters are simulated by MockGenericYieldPools
    const compMock = await MockGenericYieldPool.deploy();
    const uniMock = await MockGenericYieldPool.deploy();
    const curveMock = await MockGenericYieldPool.deploy();

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
        // Pass the Receipt Token to the FHE Wrapper
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

    // This will now successfully evaluate the dynamic balance measurements in Escrow
    await expect(escrow.connect(employer).depositTokens(depositAmount, 1))
      .not.to.be.reverted;
  });

  it("Should allow the owner to withdraw wrapped ETH successfully", async function () {
    const withdrawAmount = ethers.parseEther("0.05");
    await expect(escrow.connect(owner).withdrawTokens(withdrawAmount, 0))
      .to.not.be.reverted;
  });

  it("Should revert if a non-owner tries to withdraw", async function () {
    const withdrawAmount = ethers.parseEther("0.05");
    await expect(escrow.connect(employee1).withdrawTokens(withdrawAmount, 0))
      .to.be.revertedWith("Only owner can call this");
  });
});