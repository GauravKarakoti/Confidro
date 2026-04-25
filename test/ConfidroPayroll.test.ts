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

  it("0. Should initialize total payroll to 0 on deployment", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    
    // Verify that the constructor properly initialized the FHE ciphertext
    // and granted the owner read access
    const encryptedTotal = await payroll.getEncryptedTotal();
    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint32).execute();
    
    expect(Number(decryptedTotal)).to.equal(0);
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

  it("3. Employee can withdraw salary (and owner retains access to total)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint32(5000n)]).execute();

    // Owner adds the employee
    await payroll.addEmployee(employee1Address, encryptedSalary);

    // Employee withdraws their salary
    await expect(
      payroll.connect(employee1).withdrawSalary()
    ).to.emit(payroll, "SalaryWithdrawn");

    const isActive = await payroll.hasActiveSalary(employee1Address);
    expect(isActive).to.equal(false);

    // Verify the owner can STILL decrypt the total payroll after employee withdraws
    const encryptedTotal = await payroll.getEncryptedTotal();
    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint32).execute();
    
    // Total should be back to 0 since the only employee withdrew their 5000
    expect(Number(decryptedTotal)).to.equal(0);
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

  it("7. Should return the list of added employees using getEmployees()", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    // Encrypt salaries for two employees
    const [salary1] = await fhe.encryptInputs([Encryptable.uint32(1000n)]).execute();
    const [salary2] = await fhe.encryptInputs([Encryptable.uint32(2000n)]).execute();

    // Add employees to the contract
    await payroll.addEmployee(employee1Address, salary1);
    await payroll.addEmployee(employee2Address, salary2);

    // Fetch the employee list using the new getter method
    const employees = await payroll.getEmployees();

    // Verify the array length and addresses
    expect(employees.length).to.equal(2);
    expect(employees[0]).to.equal(employee1Address);
    expect(employees[1]).to.equal(employee2Address);
  });

  it("8. Should revert if non-owner tries to add employee", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();
    
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint32(5000n)]).execute();

    // Connect as employee1 (non-owner) and try to add an employee
    await expect(
      payroll.connect(employee1).addEmployee(employee1Address, encryptedSalary)
    ).to.be.revertedWith("Only owner can call this");
  });

  it("9. Should revert if non-owner tries to process payroll", async function () {
    // Connect as employee1 (non-owner) and try to process payroll
    await expect(
      payroll.connect(employee1).processPayroll()
    ).to.be.revertedWith("Only owner can call this");
  });
});