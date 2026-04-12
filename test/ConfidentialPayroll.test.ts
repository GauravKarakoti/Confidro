import { expect } from "chai";
import hre from "hardhat";
import { Contract, Signer } from "ethers";

describe("ConfidroPayroll", function () {
  let payroll: Contract;
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
    const encryptedSalary = await fhe.encrypt32(5000);

    await expect(payroll.addEmployee(employee1Address, encryptedSalary))
      .to.emit(payroll, "EmployeeAdded");

    const stored = await payroll.salaries(employee1Address);

    // Decrypt to verify
    const decrypted = await fhe.decrypt32(stored);
    expect(decrypted).to.equal(5000);
  });

  it("2. Should process payroll without error", async function () {
    await expect(payroll.processPayroll())
      .to.emit(payroll, "PayrollProcessed");
  });

  it("3. Employee can withdraw salary (and becomes inactive)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const encryptedSalary = await fhe.encrypt32(5000);

    await payroll.addEmployee(employee1Address, encryptedSalary);

    await expect(
      payroll.connect(employee1).withdrawSalary()
    ).to.emit(payroll, "SalaryWithdrawn");

    // Check inactive instead of zero salary
    const isActive = await payroll.hasActiveSalary(employee1Address);
    expect(isActive).to.equal(false);
  });

  it("4. Owner can view and decrypt total payroll", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const salary1 = await fhe.encrypt32(1000);
    const salary2 = await fhe.encrypt32(2000);

    await payroll.addEmployee(employee1Address, salary1);
    await payroll.addEmployee(employee2Address, salary2);

    const encryptedTotal = await payroll.getEncryptedTotal();

    const decryptedTotal = await fhe.decrypt32(encryptedTotal);
    expect(decryptedTotal).to.equal(3000);
  });

  it("5. Handles large numbers correctly (no overflow issues)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const maxUint32 = 4294967295;

    const largeSalary = await fhe.encrypt32(maxUint32);

    await payroll.addEmployee(employee1Address, largeSalary);

    const encryptedTotal = await payroll.getEncryptedTotal();
    const decryptedTotal = await fhe.decrypt32(encryptedTotal);

    expect(decryptedTotal).to.equal(maxUint32);
  });

  it("6. Prevents double withdrawal", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const encryptedSalary = await fhe.encrypt32(5000);

    await payroll.addEmployee(employee1Address, encryptedSalary);

    await payroll.connect(employee1).withdrawSalary();

    await expect(
      payroll.connect(employee1).withdrawSalary()
    ).to.be.revertedWith("No salary to withdraw");
  });
});