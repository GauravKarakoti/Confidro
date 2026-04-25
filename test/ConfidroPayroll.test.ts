import { expect } from "chai";
import hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Encryptable, FheTypes } from "@cofhe/sdk";

describe("ConfidroPayroll", function () {
  let payroll: any; 
  let owner: HardhatEthersSigner;
  let employee1: HardhatEthersSigner;
  let employee2: HardhatEthersSigner;
  // NEW: Add a signer for the compliance officer
  let complianceOfficer: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, employee1, employee2, complianceOfficer] = await hre.ethers.getSigners();

    const ConfidroPayroll = await hre.ethers.getContractFactory("ConfidroPayroll");
    payroll = await ConfidroPayroll.deploy(owner);
    await payroll.waitForDeployment();
  });

  it("0. Should initialize total payroll to 0 on deployment", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    
    // Verify that the constructor properly initialized the FHE ciphertext
    // and granted the owner read access
    const encryptedTotal = await payroll.getEncryptedTotal();
    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedTotal)).to.equal(0);
  });

  it("1. Should add employee with encrypted salary", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    // Finalize with .execute() and destructure the result directly
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

    await expect(payroll.addEmployee(employee1Address, encryptedSalary))
      .to.emit(payroll, "EmployeeAdded");

    const stored = await payroll.salaries(employee1Address);

    // Use decryptForView and finalize with .execute()
    const decrypted = await fhe.decryptForView(stored, FheTypes.Uint64).execute();
    expect(Number(decrypted)).to.equal(5000);
  });

  it("2. Should process payroll without error", async function () {
    await expect(payroll.processPayroll())
      .to.emit(payroll, "PayrollProcessed");
  });

  it("3. Employee can withdraw salary (and owner retains access to total)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

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
    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint64).execute();
    
    // Total should be back to 0 since the only employee withdrew their 5000
    expect(Number(decryptedTotal)).to.equal(0);
  });

  it("4. Owner can view and decrypt total payroll", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const [salary1] = await fhe.encryptInputs([Encryptable.uint64(1000n)]).execute();
    const [salary2] = await fhe.encryptInputs([Encryptable.uint64(2000n)]).execute();

    await payroll.addEmployee(employee1Address, salary1);
    await payroll.addEmployee(employee2Address, salary2);

    const encryptedTotal = await payroll.getEncryptedTotal();

    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint64).execute();
    expect(Number(decryptedTotal)).to.equal(3000);
  });

  it("5. Handles large numbers correctly (no overflow issues)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const maxUint64 = 4294967295n; 

    const [largeSalary] = await fhe.encryptInputs([Encryptable.uint64(maxUint64)]).execute();

    await payroll.addEmployee(employee1Address, largeSalary);

    const encryptedTotal = await payroll.getEncryptedTotal();
    
    const decryptedTotal = await fhe.decryptForView(encryptedTotal, FheTypes.Uint64).execute();
    expect(Number(decryptedTotal)).to.equal(Number(maxUint64));
  });

  it("6. Prevents double withdrawal", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

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
    const [salary1] = await fhe.encryptInputs([Encryptable.uint64(1000n)]).execute();
    const [salary2] = await fhe.encryptInputs([Encryptable.uint64(2000n)]).execute();

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
    
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

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

  it("10. Employee can decrypt their own salary", async function () {
    // Create an FHE client for the owner and one specifically for employee1
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheEmployee = await hre.cofhe.createClientWithBatteries(employee1);
    
    const employee1Address = await employee1.getAddress();

    // Owner encrypts and adds the salary
    const [encryptedSalary] = await fheOwner.encryptInputs([Encryptable.uint64(7500n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedSalary);

    // Fetch the stored encrypted salary
    const storedSalary = await payroll.salaries(employee1Address);

    // Employee 1 uses their own client/wallet to decrypt their salary
    const decrypted = await fheEmployee.decryptForView(storedSalary, FheTypes.Uint64).execute();
    expect(Number(decrypted)).to.equal(7500);
  });

  it("11. Unauthorized user cannot decrypt someone else's salary or total", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    // Client for Employee 2 (the attacker in this scenario)
    const fheEmployee2 = await hre.cofhe.createClientWithBatteries(employee2);
    
    const employee1Address = await employee1.getAddress();
    
    // Owner adds Employee 1
    const [encryptedSalary] = await fheOwner.encryptInputs([Encryptable.uint64(5000n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedSalary);

    const storedSalary = await payroll.salaries(employee1Address);
    const encryptedTotal = await payroll.getEncryptedTotal();

    // Employee 2 tries to decrypt Employee 1's salary (should fail)
    let salaryErrorOccurred = false;
    try {
      await fheEmployee2.decryptForView(storedSalary, FheTypes.Uint64).execute();
    } catch (error) {
      salaryErrorOccurred = true;
    }
    expect(salaryErrorOccurred).to.be.true;

    // Employee 2 tries to decrypt the total payroll (should fail)
    let totalErrorOccurred = false;
    try {
      await fheEmployee2.decryptForView(encryptedTotal, FheTypes.Uint64).execute();
    } catch (error) {
      totalErrorOccurred = true;
    }
    expect(totalErrorOccurred).to.be.true;
  });

  it("12. Employer (owner) can successfully decrypt total payroll", async function () {
    // Client specifically for the Employer (owner)
    const fheEmployer = await hre.cofhe.createClientWithBatteries(owner);
    
    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    // Employer encrypts salaries for both employees
    const [salary1] = await fheEmployer.encryptInputs([Encryptable.uint64(3000n)]).execute();
    const [salary2] = await fheEmployer.encryptInputs([Encryptable.uint64(4500n)]).execute();

    // Employer adds the employees to the contract
    await payroll.addEmployee(employee1Address, salary1);
    await payroll.addEmployee(employee2Address, salary2);

    // Fetch the updated encrypted total payroll from the contract
    const encryptedTotal = await payroll.getEncryptedTotal();

    // Employer decrypts the total
    const decryptedTotal = await fheEmployer.decryptForView(encryptedTotal, FheTypes.Uint64).execute();
    
    // 3000 + 4500 = 7500
    expect(Number(decryptedTotal)).to.equal(7500);
  });

  // -------------------------------------------------------------------------
  // NEW: Compliance & Privara Settlement Tests
  // -------------------------------------------------------------------------

  it("13. Should allow owner to set Privara Escrow and add Compliance Officer", async function () {
    const dummyEscrowAddress = await employee2.getAddress(); // Mock address for escrow
    const complianceAddress = await complianceOfficer.getAddress();

    // Set Escrow
    await expect(payroll.setPrivaraEscrow(dummyEscrowAddress))
      .to.emit(payroll, "PrivaraEscrowSet")
      .withArgs(dummyEscrowAddress);
    
    expect(await payroll.privaraEscrow()).to.equal(dummyEscrowAddress);

    // Add Compliance Officer
    await expect(payroll.addCompliance(complianceAddress))
      .to.emit(payroll, "ComplianceAdded")
      .withArgs(complianceAddress);
      
    expect(await payroll.isCompliance(complianceAddress)).to.be.true;
  });

  it("14. Selective Disclosure: Compliance Officer can decrypt total payroll but NOT individual salaries", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheCompliance = await hre.cofhe.createClientWithBatteries(complianceOfficer);
    
    const employee1Address = await employee1.getAddress();
    const complianceAddress = await complianceOfficer.getAddress();

    // 1. Owner adds an employee with a salary
    const [encryptedSalary] = await fheOwner.encryptInputs([Encryptable.uint64(8200n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedSalary);

    // 2. Owner assigns the compliance role. 
    // This dynamically triggers `FHE.allow(totalPayroll, officer)`
    await payroll.addCompliance(complianceAddress);

    // 3. Compliance Officer fetches the total payroll ciphertext
    const encryptedTotal = await payroll.getEncryptedTotal();

    // Compliance Officer successfully decrypts the total
    const decryptedTotal = await fheCompliance.decryptForView(encryptedTotal, FheTypes.Uint64).execute();
    expect(Number(decryptedTotal)).to.equal(8200);

    // 4. Compliance Officer attempts to decrypt the individual employee's salary
    const storedSalary = await payroll.salaries(employee1Address);
    
    let unauthorizedAccessCaught = false;
    try {
      await fheCompliance.decryptForView(storedSalary, FheTypes.Uint64).execute();
    } catch (error) {
      unauthorizedAccessCaught = true;
    }
    
    // The library should throw an error because the compliance officer lacks permission for `salaries`
    expect(unauthorizedAccessCaught).to.be.true;
  });
});