import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { Signer } from "ethers";

describe("ConfidroEscrow", function () {
  let owner: Signer;
  let employer: Signer;
  let employee1: Signer;
  let employee2: Signer;

  let wethMock: any;
  let usdcMock: any;
  let aavePoolMockAddress: string;
  let wrapperEthMock: any;
  let wrapperUsdcMock: any;
  let escrow: any;
  let mockPayroll: any;

  beforeEach(async function () {
    [owner, employer, employee1, employee2] = await ethers.getSigners();

    // 1. Deploy Standard Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdcMock = await MockERC20.deploy();
    
    const MockWETH = await ethers.getContractFactory("MockWETH");
    wethMock = await MockWETH.deploy();

    // 2. Deploy Mock Aave Pool
    const MockAavePool = await ethers.getContractFactory("MockAavePool");
    const aavePoolMock = await MockAavePool.deploy();
    aavePoolMockAddress = await aavePoolMock.getAddress();

    const FHERC20Wrapper = await ethers.getContractFactory("FHERC20Wrapper");
    wrapperEthMock = await FHERC20Wrapper.deploy(await wethMock.getAddress(), 18, true); 
    wrapperUsdcMock = await FHERC20Wrapper.deploy(await usdcMock.getAddress(), 6, false); 

    // 3. Deploy MockPayroll Contract & Set Tokens
    const MockPayroll = await ethers.getContractFactory("MockPayroll");
    mockPayroll = await MockPayroll.deploy();
    await mockPayroll.setTokens(await wrapperEthMock.getAddress(), await wrapperUsdcMock.getAddress());

    // 4. Deploy Escrow with updated constructor arguments
    const ConfidroEscrow = await ethers.getContractFactory("ConfidroEscrow");
    escrow = await ConfidroEscrow.deploy(
      await owner.getAddress(),
      await mockPayroll.getAddress(),
      await wrapperEthMock.getAddress(),
      await wrapperUsdcMock.getAddress(),
      aavePoolMockAddress,
      await wethMock.getAddress(),
      await usdcMock.getAddress()
    );

    await usdcMock.mint(await employer.getAddress(), ethers.parseUnits("10000", 6));
  });

  describe("Deployment", function () {
    it("Should set the correct addresses", async function () {
      expect(await escrow.owner()).to.equal(await owner.getAddress());
      expect(await escrow.payrollContract()).to.equal(await mockPayroll.getAddress());
      expect(await escrow.tokenETH()).to.equal(await wrapperEthMock.getAddress());
      expect(await escrow.tokenUSDC()).to.equal(await wrapperUsdcMock.getAddress());
    });

    it("Should initialize the encrypted budgets properly", async function () {
      expect(await escrow.budgetETH()).to.not.be.undefined;
      expect(await escrow.budgetUSDC()).to.not.be.undefined;
    });
  });

  describe("Deposit Tokens", function () {
    it("Should deposit and wrap native ETH successfully for 0.0001 ETH", async function () {
      const depositAmount = ethers.parseEther("0.0001");

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 0, { value: depositAmount })
      )
        .to.emit(escrow, "DepositedNative")
        .withArgs(await employer.getAddress(), depositAmount);

      const updatedBudget = await escrow.budgetETH();
      expect(updatedBudget).to.not.be.undefined;
    });

    it("Should revert ETH deposit if msg.value mismatches amount", async function () {
      const depositAmount = ethers.parseEther("0.0001");
      const wrongValue = ethers.parseEther("0.00005"); 

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 0, { value: wrongValue })
      ).to.be.revertedWith("Incorrect ETH value sent");
    });

    it("Should deposit and wrap USDC successfully for 1 USDC", async function () {
      const depositAmount = ethers.parseUnits("1", 6);

      await usdcMock.connect(employer).approve(await escrow.getAddress(), depositAmount);

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 1)
      )
        .to.emit(escrow, "DepositedTokens")
        .withArgs(await employer.getAddress(), await wrapperUsdcMock.getAddress(), depositAmount);

      const updatedBudget = await escrow.budgetUSDC();
      expect(updatedBudget).to.not.be.undefined;
    });

    it("Should revert USDC deposit if native ETH is accidentally sent", async function () {
      const depositAmount = ethers.parseUnits("1", 6);

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 1, { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("Native ETH sent with USDC deposit");
    });
  });

  describe("Distribute", function () {
    beforeEach(async function () {
      const ethAmount = ethers.parseEther("0.1");
      await escrow.connect(employer).depositTokens(ethAmount, 0, { value: ethAmount });
    });

    it("Should enforce onlyPayroll access control during distribution", async function () {
      const employee = await employee1.getAddress();
      const currency = 0; // ETH
      
      // Fetch an existing euint64 handle to satisfy Ethers ABI TupleCoder requirements
      const handleAmount = await escrow.budgetETH(); 

      // Should revert if called directly by an EOA (employer)
      await expect(
        escrow.connect(employer).distribute(employee, handleAmount, currency)
      ).to.be.revertedWith("Only payroll contract can distribute");
      
      // NOTE: The successful FHE distribution path requires multi-contract ACL permissions 
      // (calling FHE.allow to grant both Escrow and the Target Token access to the ciphertext). 
      // Because we cannot natively call FHE.allow() directly from javascript, the successful 
      // execution of this function is properly integration-tested in ConfidroPayroll.test.ts
    });
  });

  describe("Withdraw Tokens", function () {
    beforeEach(async function () {
      const ethAmount = ethers.parseEther("0.1");
      await escrow.connect(employer).depositTokens(ethAmount, 0, { value: ethAmount });

      const usdcAmount = ethers.parseUnits("10", 6);
      await usdcMock.connect(employer).approve(await escrow.getAddress(), usdcAmount);
      await escrow.connect(employer).depositTokens(usdcAmount, 1);
    });

    it("Should withdraw wrapped ETH successfully when called by owner", async function () {
      const withdrawAmount = ethers.parseEther("0.05");
      const ownerAddress = await owner.getAddress();
      
      await expect(escrow.connect(owner).withdrawTokens(withdrawAmount, 0))
        .to.not.be.reverted;

      const encryptedBalance = await wrapperEthMock.getEncryptedBalance(ownerAddress);
      expect(encryptedBalance).to.not.be.undefined;
      expect(await escrow.budgetETH()).to.not.be.undefined;
    });

    it("Should withdraw wrapped USDC successfully when called by owner", async function () {
      const withdrawAmount = ethers.parseUnits("5", 6);
      const ownerAddress = await owner.getAddress();
      
      await expect(escrow.connect(owner).withdrawTokens(withdrawAmount, 1))
        .to.not.be.reverted;

      const encryptedBalance = await wrapperUsdcMock.getEncryptedBalance(ownerAddress);
      expect(encryptedBalance).to.not.be.undefined;
      expect(await escrow.budgetUSDC()).to.not.be.undefined;
    });

    it("Should revert if a non-owner tries to withdraw", async function () {
      const withdrawAmount = ethers.parseEther("0.05");
      await expect(
        escrow.connect(employer).withdrawTokens(withdrawAmount, 0)
      ).to.be.revertedWith("Only owner can call this");
    });
  });
});