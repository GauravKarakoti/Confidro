import { expect } from "chai";
import hre from "hardhat";
import { Signer } from "ethers";
import { Encryptable, FheTypes } from "@cofhe/sdk";

describe("ConfidroPayroll", function () {
  let payroll: any; 
  let owner: Signer;
  let employee1: Signer;
  let employee2: Signer;

  beforeEach(async function () {
    [owner, employee1, employee2] = await hre.ethers.getSigners();

    const ConfidroPayroll = await hre.ethers.getContractFactory("ConfidroPayroll");
    payroll = await ConfidroPayroll.deploy();
    await payroll.waitForDeployment();
  });

  it("1. Should add employee with encrypted salary", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    // Finalize with .execute() and destructure the result directly
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint32(5000n)]).execute();

    await expect(payroll.addEmployee(employee1Address, encryptedSalary))
      .to.emit(payroll, "EmployeeAdded");

    const stored = await payroll.salaries(employee1Address);

    // Use decryptForView and finalize with .execute()
    const decrypted = await fhe.decryptForView(stored, FheTypes.Uint32).execute();
    expect(Number(decrypted)).to.equal(5000);
  });

  it("2. Should process payroll without error", async function () {
    await expect(payroll.processPayroll())
      .to.emit(payroll, "PayrollProcessed");
  });

  it("3. Employee can withdraw salary (and becomes inactive)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint32(5000n)]).execute();

    await payroll.addEmployee(employee1Address, encryptedSalary);

    await expect(
      payroll.connect(employee1).withdrawSalary()
    ).to.emit(payroll, "SalaryWithdrawn");

    const isActive = await payroll.hasActiveSalary(employee1Address);
    expect(isActive).to.equal(false);
  });

  it("4. Owner can view and decrypt total payroll", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const [salary1] = await fhe.encryptInputs([Encryptable.uint32(1000n)]).execute();
    const [salary2] = await fhe.encryptInputs([Encryptable.uint32(2000n)]).execute();

    await payroll.addEmployee(employee1Address, salary1);
    await payroll.addEmployee(employee2Address, salary2);

    const encryptedTotal = await payroll.getEncryptedTotal();

    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint32).execute();
    expect(Number(decryptedTotal)).to.equal(3000);
  });

  it("5. Handles large numbers correctly (no overflow issues)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const maxUint32 = 4294967295n; 

    const [largeSalary] = await fhe.encryptInputs([Encryptable.uint32(maxUint32)]).execute();

    await payroll.addEmployee(employee1Address, largeSalary);

    const encryptedTotal = await payroll.getEncryptedTotal();
    
    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint32).execute();
    expect(Number(decryptedTotal)).to.equal(Number(maxUint32));
  });

  it("6. Prevents double withdrawal", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint32(5000n)]).execute();

    await payroll.addEmployee(employee1Address, encryptedSalary);

    await payroll.connect(employee1).withdrawSalary();

    await expect(
      payroll.connect(employee1).withdrawSalary()
    ).to.be.revertedWith("No salary to withdraw");
  });
});