import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("ConfidroEscrow", function () {
  let owner: Signer;
  let payrollContract: Signer;
  let employer: Signer;
  let employee1: Signer;
  let employee2: Signer;

  let wethMock: any;
  let usdcMock: any;
  let wrapperEthMock: any;
  let wrapperUsdcMock: any;
  let escrow: any;

  beforeEach(async function () {
    [owner, payrollContract, employer, employee1, employee2] = await ethers.getSigners();

    // 1. Deploy Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdcMock = await MockERC20.deploy();
    
    const MockWETH = await ethers.getContractFactory("MockWETH");
    wethMock = await MockWETH.deploy();

    const MockFHERC20Wrapper = await ethers.getContractFactory("MockFHERC20Wrapper");
    wrapperEthMock = await MockFHERC20Wrapper.deploy(await wethMock.getAddress());
    wrapperUsdcMock = await MockFHERC20Wrapper.deploy(await usdcMock.getAddress());

    // 2. Deploy Escrow
    const ConfidroEscrow = await ethers.getContractFactory("ConfidroEscrow");
    escrow = await ConfidroEscrow.deploy(
      await owner.getAddress(),
      await payrollContract.getAddress(),
      await wrapperEthMock.getAddress(),
      await wrapperUsdcMock.getAddress()
    );

    // 3. Setup initial employer funds
    await usdcMock.mint(await employer.getAddress(), ethers.parseUnits("10000", 6));
  });

  describe("Deployment", function () {
    it("Should set the correct addresses", async function () {
      expect(await escrow.owner()).to.equal(await owner.getAddress());
      expect(await escrow.payrollContract()).to.equal(await payrollContract.getAddress());
      expect(await escrow.tokenETH()).to.equal(await wrapperEthMock.getAddress());
      expect(await escrow.tokenUSDC()).to.equal(await wrapperUsdcMock.getAddress());
    });
  });

  describe("Deposit Tokens", function () {
    it("Should deposit and wrap native ETH successfully", async function () {
      const depositAmount = ethers.parseEther("5");

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 0, { value: depositAmount })
      )
        .to.emit(escrow, "DepositedNative")
        .withArgs(await employer.getAddress(), depositAmount);

      // Verify WETH balance of wrapper mock increased (since escrow deposits WETH and wrapper pulls it)
      expect(await wethMock.balanceOf(await wrapperEthMock.getAddress())).to.equal(depositAmount);
      // Verify wrap was called
      expect(await wrapperEthMock.wrapCalledAmount()).to.equal(depositAmount);
    });

    it("Should revert ETH deposit if msg.value mismatches amount", async function () {
      const depositAmount = ethers.parseEther("5");
      const wrongValue = ethers.parseEther("4");

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 0, { value: wrongValue })
      ).to.be.revertedWith("Incorrect ETH value sent");
    });

    it("Should deposit and wrap USDC successfully", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);

      // Employer must approve escrow to pull standard USDC
      await usdcMock.connect(employer).approve(await escrow.getAddress(), depositAmount);

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 1)
      )
        .to.emit(escrow, "DepositedTokens")
        .withArgs(await employer.getAddress(), await wrapperUsdcMock.getAddress(), depositAmount);

      // Verify wrap was called
      expect(await wrapperUsdcMock.wrapCalledAmount()).to.equal(depositAmount);
    });

    it("Should revert USDC deposit if native ETH is accidentally sent", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);

      await expect(
        escrow.connect(employer).depositTokens(depositAmount, 1, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Native ETH sent with USDC deposit");
    });
  });

  describe("Distribute", function () {
    it("Should distribute FHE tokens to employees", async function () {
      const employees = [await employee1.getAddress(), await employee2.getAddress()];
      
      // FIX: Convert the dummy amounts into 32-byte hex strings to satisfy the euint64 ABI requirement
      const amounts = [
        ethers.zeroPadValue(ethers.toBeHex(1000), 32), 
        ethers.zeroPadValue(ethers.toBeHex(2000), 32)
      ]; 
      const currencies = [0, 1]; // employee1 gets ETH, employee2 gets USDC

      // Should revert if called by non-payroll
      await expect(
        escrow.connect(employer).distribute(employees, amounts, currencies)
      ).to.be.revertedWith("Only payroll contract can distribute");

      // Should succeed when called by payroll contract
      await expect(
        escrow.connect(payrollContract).distribute(employees, amounts, currencies)
      )
        .to.emit(escrow, "TokensDistributed")
        .withArgs(2);
    });

    it("Should revert on mismatched array lengths", async function () {
      const employees = [await employee1.getAddress(), await employee2.getAddress()];
      
      // FIX: Apply the 32-byte padding here as well
      const amounts = [ethers.zeroPadValue(ethers.toBeHex(1000), 32)]; // Mismatch
      const currencies = [0, 1];

      await expect(
        escrow.connect(payrollContract).distribute(employees, amounts, currencies)
      ).to.be.revertedWith("Mismatched arrays");
    });
  });
});