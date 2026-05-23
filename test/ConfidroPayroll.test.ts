import { expect } from "chai";
import hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Encryptable, FheTypes } from "@cofhe/sdk";

describe("ConfidroPayroll", function () {
  let payroll: any; 
  let owner: HardhatEthersSigner;
  let employee1: HardhatEthersSigner;
  let employee2: HardhatEthersSigner;
  let complianceOfficer: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, employee1, employee2, complianceOfficer] = await hre.ethers.getSigners();

    const ConfidroPayroll = await hre.ethers.getContractFactory("ConfidroPayroll");
    payroll = await ConfidroPayroll.deploy(owner);
    await payroll.waitForDeployment();
  });

  it("0. Should initialize total flow rates for ETH and USDC to 0 on deployment", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    
    const [ethTotal, usdcTotal] = await payroll.getEncryptedTotals();
    
    const decryptedETH = await fhe.decryptForView(ethTotal, FheTypes.Uint64).execute();
    const decryptedUSDC = await fhe.decryptForView(usdcTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(0);
    expect(Number(decryptedUSDC)).to.equal(0);
  });

  it("1. Should add employee with encrypted flow rate and currency type", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const [encryptedFlowRate] = await fhe.encryptInputs([Encryptable.uint64(50n)]).execute();

    // 0 for ETH currency
    await expect(payroll.addEmployee(employee1Address, encryptedFlowRate, 0))
      .to.emit(payroll, "EmployeeAdded");

    const stored = await payroll.encryptedFlowRates(employee1Address);
    const currency = await payroll.paymentCurrency(employee1Address);

    const decrypted = await fhe.decryptForView(stored, FheTypes.Uint64).execute();
    expect(Number(decrypted)).to.equal(50);
    expect(currency).to.equal(0);
  });

  it("2. Should successfully claim streaming payroll and distribute through Escrow", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    // FIXED: Added required constructor arguments
    const mockTokenETH = await MockToken.deploy("Mock ETH", "ETH", 18);
    const mockTokenUSDC = await MockToken.deploy("Mock USDC", "USDC", 6);
    const mockAave = await MockToken.deploy("Mock Aave Token", "aToken", 18); 
    
    await payroll.deployAndSetEscrow(
      await mockTokenETH.getAddress(), 
      await mockTokenUSDC.getAddress(),
      await mockAave.getAddress(),
      await mockTokenETH.getAddress(),
      await mockTokenUSDC.getAddress()
    );

    const [encryptedFlowRate] = await fhe.encryptInputs([Encryptable.uint64(50n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedFlowRate, 0); 

    await hre.network.provider.send("evm_increaseTime", [3600]); 
    await hre.network.provider.send("evm_mine");

    await expect(payroll.connect(employee1).claimStream())
      .to.emit(payroll, "StreamClaimed");
  });

  it("3. Employee can claim stream repeatedly as time passes", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    const mockTokenETH = await MockToken.deploy("Mock ETH", "ETH", 18); // FIXED
    await payroll.deployAndSetEscrow(
      await mockTokenETH.getAddress(), await mockTokenETH.getAddress(),
      await mockTokenETH.getAddress(), await mockTokenETH.getAddress(), await mockTokenETH.getAddress()
    );

    const [encryptedFlowRate] = await fhe.encryptInputs([Encryptable.uint64(50n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedFlowRate, 1); 

    await hre.network.provider.send("evm_increaseTime", [3600]);
    await hre.network.provider.send("evm_mine");
    await expect(payroll.connect(employee1).claimStream()).to.emit(payroll, "StreamClaimed");

    await hre.network.provider.send("evm_increaseTime", [3600]);
    await hre.network.provider.send("evm_mine");
    await expect(payroll.connect(employee1).claimStream()).to.emit(payroll, "StreamClaimed");
  });

  it("4. Prevents claiming stream with 0 time delta", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    const mockTokenETH = await MockToken.deploy("Mock ETH", "ETH", 18); // FIXED
    await payroll.deployAndSetEscrow(
      await mockTokenETH.getAddress(), await mockTokenETH.getAddress(),
      await mockTokenETH.getAddress(), await mockTokenETH.getAddress(), await mockTokenETH.getAddress()
    );

    const [encryptedFlowRate] = await fhe.encryptInputs([Encryptable.uint64(50n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedFlowRate, 0);

    const abiCoder = new hre.ethers.AbiCoder();
    const slot = hre.ethers.keccak256(abiCoder.encode(["address", "uint256"], [employee1Address, 2]));

    const latestBlock = await hre.ethers.provider.getBlock("latest");
    const nextTimestamp = latestBlock!.timestamp + 100;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp]);

    await hre.network.provider.send("hardhat_setStorageAt", [
      await payroll.getAddress(),
      slot,
      hre.ethers.toBeHex(nextTimestamp, 32)
    ]);

    await expect(
      payroll.connect(employee1).claimStream({ gasLimit: 15000000 })
    ).to.be.revertedWith("Too early to claim");
  });

  it("5. Owner can view and decrypt dual total flow rates (ETH & USDC)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const [flow1] = await fhe.encryptInputs([Encryptable.uint64(10n)]).execute();
    const [flow2] = await fhe.encryptInputs([Encryptable.uint64(20n)]).execute();

    await payroll.addEmployee(employee1Address, flow1, 0);
    await payroll.addEmployee(employee2Address, flow2, 1);

    const [ethTotal, usdcTotal] = await payroll.getEncryptedTotals();

    const decryptedETH = await fhe.decryptForView(ethTotal, FheTypes.Uint64).execute();
    const decryptedUSDC = await fhe.decryptForView(usdcTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(10);
    expect(Number(decryptedUSDC)).to.equal(20);
  });

  it("6. Should allow owner to deploy and set escrow with required Aave parameters", async function () {
    const dummyAddr = await employee1.getAddress();

    expect(await payroll.privaraEscrow()).to.equal(hre.ethers.ZeroAddress);

    const tx = await payroll.deployAndSetEscrow(dummyAddr, dummyAddr, dummyAddr, dummyAddr, dummyAddr);
    
    const newEscrowAddress = await payroll.privaraEscrow();
    expect(newEscrowAddress).to.not.equal(hre.ethers.ZeroAddress);

    await expect(tx).to.emit(payroll, "PrivaraEscrowSet").withArgs(newEscrowAddress);
  });

  it("7. Selective Disclosure: Employees can grant and revoke income view permits", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheThirdParty = await hre.cofhe.createClientWithBatteries(complianceOfficer);
    
    const employee1Address = await employee1.getAddress();
    const thirdPartyAddress = await complianceOfficer.getAddress();

    const [encryptedFlow] = await fheOwner.encryptInputs([Encryptable.uint64(8200n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedFlow, 0);

    // Third party tries to view before permit
    await expect(
      payroll.connect(complianceOfficer).verifyEmployeeIncome(employee1Address)
    ).to.be.revertedWith("Permit not active");

    // Employee grants permit for 1 hour
    await expect(payroll.connect(employee1).grantIncomeViewPermit(thirdPartyAddress, 3600))
      .to.emit(payroll, "PermitGranted");

    // Third party can now fetch the encrypted handle
    const permittedFlow = await payroll.connect(complianceOfficer).verifyEmployeeIncome(employee1Address);
    expect(permittedFlow).to.not.be.undefined;

    // Fast forward past expiry
    await hre.network.provider.send("evm_increaseTime", [7200]); 
    await hre.network.provider.send("evm_mine");

    await expect(
      payroll.connect(complianceOfficer).verifyEmployeeIncome(employee1Address)
    ).to.be.revertedWith("Permit expired");

    // Revoke permit explicitly
    await expect(payroll.connect(employee1).revokeIncomeViewPermit(thirdPartyAddress))
      .to.emit(payroll, "PermitRevoked");
  });

  it("8. Should allow employee to update yield routing allocations", async function () {
    // FIXED: Need an FHE client for the owner and one for the employee separately 
    // to bypass the PoK ciphertext validation checks
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheEmployee = await hre.cofhe.createClientWithBatteries(employee1);
    const employee1Address = await employee1.getAddress();

    // Use owner's FHE instance since the owner sends the addEmployee transaction
    const [encryptedFlow] = await fheOwner.encryptInputs([Encryptable.uint64(50n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedFlow, 0);

    // Setup the 4 encrypted allocations using the employee's instance
    const allocations = await fheEmployee.encryptInputs([
        Encryptable.uint64(40n),
        Encryptable.uint64(30n),
        Encryptable.uint64(20n),
        Encryptable.uint64(10n)
    ]).execute();

    await expect(payroll.connect(employee1).updateYieldRouting(allocations))
        .to.emit(payroll, "YieldRoutingUpdated")
        .withArgs(employee1Address);

    const aaveAlloc = await payroll.aaveAllocations(employee1Address);
    const curveAlloc = await payroll.curveAllocations(employee1Address);
    
    expect(aaveAlloc).to.not.be.undefined;
    expect(curveAlloc).to.not.be.undefined;
  });
});