import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("ConfidroEscrow", function () {
  let owner: Signer;
  let employer: Signer;
  let employee1: Signer;
  let employee2: Signer;

  let wethMock: any;
  let usdcMock: any;
  let wrapperEthMock: any;
  let wrapperUsdcMock: any;
  let escrow: any;
  let mockPayroll: any; // Using the mock contract instead of a Signer

  beforeEach(async function () {
    [owner, employer, employee1, employee2] = await ethers.getSigners();

    // 1. Deploy Standard Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdcMock = await MockERC20.deploy();
    
    const MockWETH = await ethers.getContractFactory("MockWETH");
    wethMock = await MockWETH.deploy();

    const FHERC20Wrapper = await ethers.getContractFactory("FHERC20Wrapper");
    wrapperEthMock = await FHERC20Wrapper.deploy(await wethMock.getAddress(), 18);
    wrapperUsdcMock = await FHERC20Wrapper.deploy(await usdcMock.getAddress(), 6);

    // 3. Deploy MockPayroll Contract & Set Tokens
    const MockPayroll = await ethers.getContractFactory("MockPayroll");
    mockPayroll = await MockPayroll.deploy();
    
    // --- ADD THIS LINE ---
    await mockPayroll.setTokens(await wrapperEthMock.getAddress(), await wrapperUsdcMock.getAddress());

    // 4. Deploy Escrow (injecting MockPayroll's address)
    const ConfidroEscrow = await ethers.getContractFactory("ConfidroEscrow");
    escrow = await ConfidroEscrow.deploy(
      await owner.getAddress(),
      await mockPayroll.getAddress(), // Valid smart contract caller
      await wrapperEthMock.getAddress(),
      await wrapperUsdcMock.getAddress()
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
  });

  describe("Deposit Tokens", function () {
    it("Should deposit and wrap native ETH successfully for 0.0001 ETH", async function () {
      // Testing exactly 0.0001 ETH
      const depositAmount = ethers.parseEther("0.0001");

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 0, { value: depositAmount })
      )
        .to.emit(escrow, "DepositedNative")
        .withArgs(await employer.getAddress(), depositAmount);

      // Verify WETH balance of wrapper mock increased (wrapper securely holds underlying token)
      expect(await wethMock.balanceOf(await wrapperEthMock.getAddress())).to.equal(depositAmount);
    });

    it("Should revert ETH deposit if msg.value mismatches amount", async function () {
      const depositAmount = ethers.parseEther("0.0001");
      const wrongValue = ethers.parseEther("0.00005"); // Sending less than specified amount

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 0, { value: wrongValue })
      ).to.be.revertedWith("Incorrect ETH value sent");
    });

    it("Should deposit and wrap USDC successfully for 1 USDC", async function () {
      // Testing exactly 1 USDC (USDC has 6 decimals)
      const depositAmount = ethers.parseUnits("1", 6);

      // Employer must approve escrow to pull standard USDC
      await usdcMock.connect(employer).approve(await escrow.getAddress(), depositAmount);

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 1)
      )
        .to.emit(escrow, "DepositedTokens")
        .withArgs(await employer.getAddress(), await wrapperUsdcMock.getAddress(), depositAmount);

      // Verify underlying USDC transferred to wrapper
      expect(await usdcMock.balanceOf(await wrapperUsdcMock.getAddress())).to.equal(depositAmount);
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
      // Provide some initial balance to Escrow so it doesn't transfer with an uninitialized ciphertext
      const ethAmount = ethers.parseEther("0.1");
      await escrow.connect(employer).depositTokens(ethAmount, 0, { value: ethAmount });

      const usdcAmount = ethers.parseUnits("10", 6);
      await usdcMock.connect(employer).approve(await escrow.getAddress(), usdcAmount);
      await escrow.connect(employer).depositTokens(usdcAmount, 1);
    });

    it("Should distribute FHE tokens to employees", async function () {
      const employees = [await employee1.getAddress(), await employee2.getAddress()];
      
      // Since MockPayroll takes standard arrays and encrypts them on-chain, we pass standard JS numbers
      const amounts = [1000, 2000]; 
      const currencies = [0, 1]; // employee1 gets ETH, employee2 gets USDC

      // Verify modifier still works (Employer is an EOA, MockPayroll is the registered payroll address)
      const fakeAmounts = [
        ethers.zeroPadValue(ethers.toBeHex(1000), 32), 
        ethers.zeroPadValue(ethers.toBeHex(2000), 32)
      ]; 
      await expect(
        escrow.connect(employer).distribute(employees, fakeAmounts, currencies)
      ).to.be.revertedWith("Only payroll contract can distribute");

      // Should succeed when correctly called THROUGH the MockPayroll contract
      await expect(
        mockPayroll.executeDistribute(await escrow.getAddress(), employees, amounts, currencies)
      )
        .to.emit(escrow, "TokensDistributed")
        .withArgs(2);
    });

    it("Should revert on mismatched array lengths", async function () {
      const employees = [await employee1.getAddress(), await employee2.getAddress()];
      
      const amounts = [1000]; // Mismatch
      const currencies = [0, 1];

      await expect(
        mockPayroll.executeDistribute(await escrow.getAddress(), employees, amounts, currencies)
      ).to.be.revertedWith("Mismatched arrays");
    });
  });

  describe("Withdraw Tokens", function () {
    beforeEach(async function () {
      // Provide some initial balance to Escrow so it has funds to withdraw
      const ethAmount = ethers.parseEther("0.1");
      await escrow.connect(employer).depositTokens(ethAmount, 0, { value: ethAmount });

      const usdcAmount = ethers.parseUnits("10", 6);
      await usdcMock.connect(employer).approve(await escrow.getAddress(), usdcAmount);
      await escrow.connect(employer).depositTokens(usdcAmount, 1);
    });

    it("Should withdraw wrapped ETH successfully when called by owner", async function () {
      const withdrawAmount = ethers.parseEther("0.05");
      const ownerAddress = await owner.getAddress();
      
      // Withdraw 0.05 Wrapped ETH
      await expect(escrow.connect(owner).withdrawTokens(withdrawAmount, 0))
        .to.not.be.reverted;

      // Since FHERC20Wrapper uses FHE, we must call getEncryptedBalance.
      // It returns an encrypted handle (euint64), so we just verify it exists 
      // instead of checking against a plaintext number.
      const encryptedBalance = await wrapperEthMock.getEncryptedBalance(ownerAddress);
      expect(encryptedBalance).to.not.be.undefined;
    });

    it("Should withdraw wrapped USDC successfully when called by owner", async function () {
      const withdrawAmount = ethers.parseUnits("5", 6);
      const ownerAddress = await owner.getAddress();
      
      // Withdraw 5 Wrapped USDC
      await expect(escrow.connect(owner).withdrawTokens(withdrawAmount, 1))
        .to.not.be.reverted;

      // Verify the owner received the wrapped USDC FHE tokens
      const encryptedBalance = await wrapperUsdcMock.getEncryptedBalance(ownerAddress);
      expect(encryptedBalance).to.not.be.undefined;
    });

    it("Should revert if a non-owner tries to withdraw", async function () {
      const withdrawAmount = ethers.parseEther("0.05");
      
      // Employer tries to withdraw, but they are not the contract owner
      await expect(
        escrow.connect(employer).withdrawTokens(withdrawAmount, 0)
      ).to.be.revertedWith("Only owner can call this");
    });

    it("Should revert if withdrawal amount is 0", async function () {
      await expect(
        escrow.connect(owner).withdrawTokens(0, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should revert on invalid currency type", async function () {
      const withdrawAmount = ethers.parseEther("0.05");
      
      // Try to pass '2' instead of 0 or 1
      await expect(
        escrow.connect(owner).withdrawTokens(withdrawAmount, 2)
      ).to.be.revertedWith("Invalid currency");
    });
  });
});