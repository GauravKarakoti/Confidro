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
    payroll = await ConfidroPayroll.deploy(owner.address);
    await payroll.waitForDeployment();
  });

  it("0. Should initialize total flow rates for ETH and USDC to 0 on deployment", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    
    const [ethTotal, usdcTotal] = await payroll.getEncryptedTotals();
    
    const decryptedETH = await fheOwner.decryptForView(ethTotal, FheTypes.Uint64).execute();
    const decryptedUSDC = await fheOwner.decryptForView(usdcTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(0);
    expect(Number(decryptedUSDC)).to.equal(0);
  });

  it("1. Should deploy and set the Escrow contract with 4 yield pools successfully", async function () {
    const dummyAddress = owner.address; 
    const dummyArray = [dummyAddress, dummyAddress, dummyAddress, dummyAddress];

    await expect(payroll.deployAndSetEscrow(
      dummyAddress, dummyAddress,
      dummyArray, dummyArray, dummyArray
    )).to.emit(payroll, "PrivaraEscrowSet"); 

    const escrowAddress = await payroll.privaraEscrow();
    expect(escrowAddress).to.not.equal(hre.ethers.ZeroAddress);
  });

  it("2. Should allow owner to add compliance officer", async function () {
    await expect(payroll.addCompliance(complianceOfficer.address))
      .to.emit(payroll, "ComplianceAdded")
      .withArgs(complianceOfficer.address);

    expect(await payroll.isCompliance(complianceOfficer.address)).to.be.true;
  });

  it("3. Should allow owner to add an employee and allocate base defaults", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const [encryptedFlow] = await fheOwner.encryptInputs([Encryptable.uint64(50n)]).execute();

    await expect(payroll.addEmployee(employee1.address, encryptedFlow, 0))
      .to.emit(payroll, "EmployeeAdded")
      .withArgs(employee1.address, 0);

    expect(await payroll.hasActiveSalary(employee1.address)).to.be.true;
  });

  it("4. Should allow employee to update 4-way yield routing allocations", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheEmployee = await hre.cofhe.createClientWithBatteries(employee1);

    const [encryptedFlow] = await fheOwner.encryptInputs([Encryptable.uint64(50n)]).execute();
    await payroll.addEmployee(employee1.address, encryptedFlow, 0);

    const allocations = await fheEmployee.encryptInputs([
        Encryptable.uint64(40n),
        Encryptable.uint64(30n),
        Encryptable.uint64(20n),
        Encryptable.uint64(10n)
    ]).execute();

    await expect(payroll.connect(employee1).updateYieldRouting(allocations))
        .to.emit(payroll, "YieldRoutingUpdated")
        .withArgs(employee1.address);
  });

  it("5. Should grant, verify, and revoke income view permits securely", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const thirdPartyAddress = employee2.address;

    const [encryptedFlow] = await fheOwner.encryptInputs([Encryptable.uint64(50n)]).execute();
    await payroll.addEmployee(employee1.address, encryptedFlow, 1);

    await expect(payroll.connect(employee1).grantIncomeViewPermit(thirdPartyAddress, 3600))
      .to.emit(payroll, "PermitGranted");

    const verifiedIncome = await payroll.connect(employee2).verifyEmployeeIncome(employee1.address);
    expect(verifiedIncome).to.not.be.undefined;

    await expect(payroll.connect(employee1).revokeIncomeViewPermit(thirdPartyAddress))
      .to.emit(payroll, "PermitRevoked");
      
    await expect(payroll.connect(employee2).verifyEmployeeIncome(employee1.address))
      .to.be.revertedWith("Permit not active");
  });
});