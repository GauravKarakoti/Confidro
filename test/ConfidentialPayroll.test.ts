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
    const fhe = require("@fhenixprotocol/cofhe-hardhat-plugin").fhe;

    const employee1Address = await employee1.getAddress();
    const encryptedSalary = await fhe.encrypt32(5000);

    await expect(payroll.addEmployee(employee1Address, encryptedSalary))
      .to.emit(payroll, "EmployeeAdded");

    const salary = await payroll.salaries(employee1Address);
    expect(salary).to.not.equal(0);
  });

  it("2. Should process payroll without error", async function () {
    await expect(payroll.processPayroll())
      .to.emit(payroll, "PayrollProcessed");
  });

  it("3. Employee can withdraw salary", async function () {
    const fhe = require("@fhenixprotocol/cofhe-hardhat-plugin").fhe;

    const employee1Address = await employee1.getAddress();
    const encryptedSalary = await fhe.encrypt32(5000);

    await payroll.addEmployee(employee1Address, encryptedSalary);
    await payroll.connect(employee1).withdrawSalary();

    const salaryAfter = await payroll.salaries(employee1Address);

    // Decrypt to verify it's zero
    const decrypted = await fhe.decrypt32(salaryAfter);
    expect(decrypted).to.equal(0);
  });

  it("4. Compliance view (owner can see total)", async function () {
    const fhe = require("@fhenixprotocol/cofhe-hardhat-plugin").fhe;

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const salary1 = await fhe.encrypt32(1000);
    const salary2 = await fhe.encrypt32(2000);

    await payroll.addEmployee(employee1Address, salary1);
    await payroll.addEmployee(employee2Address, salary2);

    const total = await payroll.getDecryptedTotal();
    expect(total).to.equal(3000);
  });

  it("5. Overflow protection – FHE handles large numbers", async function () {
    const fhe = require("@fhenixprotocol/cofhe-hardhat-plugin").fhe;

    const employee1Address = await employee1.getAddress();
    const maxUint32 = 4294967295;

    const largeSalary = await fhe.encrypt32(maxUint32);

    await payroll.addEmployee(employee1Address, largeSalary);

    const total = await payroll.getDecryptedTotal();
    expect(total).to.equal(maxUint32);
  });
});