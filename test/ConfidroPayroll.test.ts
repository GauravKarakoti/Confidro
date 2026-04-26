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

  it("0. Should initialize total payroll for ETH and USDC to 0 on deployment", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    
    // getEncryptedTotals now returns [ethTotal, usdcTotal]
    const [ethTotal, usdcTotal] = await payroll.getEncryptedTotals();
    
    const decryptedETH = await fhe.decryptForView(ethTotal, FheTypes.Uint64).execute();
    const decryptedUSDC = await fhe.decryptForView(usdcTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(0);
    expect(Number(decryptedUSDC)).to.equal(0);
  });

  it("1. Should add employee with encrypted salary and currency type", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

    // 0 for ETH currency
    await expect(payroll.addEmployee(employee1Address, encryptedSalary, 0))
      .to.emit(payroll, "EmployeeAdded");

    const stored = await payroll.salaries(employee1Address);
    const currency = await payroll.paymentCurrency(employee1Address);

    const decrypted = await fhe.decryptForView(stored, FheTypes.Uint64).execute();
    expect(Number(decrypted)).to.equal(5000);
    expect(currency).to.equal(0);
  });

  it("2. Should successfully process payroll and distribute through Escrow", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    // 1. Deploy token mocks to prevent execution reverts during .transfer()
    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    const mockTokenETH = await MockToken.deploy();
    const mockTokenUSDC = await MockToken.deploy();
    await mockTokenETH.waitForDeployment();
    await mockTokenUSDC.waitForDeployment();

    // 2. Deploy and link the Escrow to the Payroll contract
    await payroll.deployAndSetEscrow(
      await mockTokenETH.getAddress(), 
      await mockTokenUSDC.getAddress()
    );

    // 3. Add an employee with an encrypted salary
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedSalary, 0); // 0 = ETH

    // 4. Process Payroll 
    // This will now execute the inner block, hit the FHE.allow() statements, 
    // call the Escrow, and successfully complete without reverting.
    await expect(payroll.processPayroll())
      .to.emit(payroll, "PayrollProcessed");
  });

  it("3. Employee can withdraw salary (and owner retains access to total)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();

    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

    // Owner adds the employee (1 for USDC this time)
    await payroll.addEmployee(employee1Address, encryptedSalary, 1);

    // Employee withdraws their salary
    await expect(
      payroll.connect(employee1).withdrawSalary()
    ).to.emit(payroll, "SalaryWithdrawn");

    const isActive = await payroll.hasActiveSalary(employee1Address);
    expect(isActive).to.equal(false);

    // Verify the owner can STILL decrypt the total payroll after employee withdraws
    const [, usdcTotal] = await payroll.getEncryptedTotals();
    const decryptedUSDC = await fhe.decryptForView(usdcTotal, FheTypes.Uint64).execute();
    
    // Total should be back to 0 since the only employee withdrew their 5000
    expect(Number(decryptedUSDC)).to.equal(0);
  });

  it("4. Owner can view and decrypt dual total payrolls (ETH & USDC)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const [salary1] = await fhe.encryptInputs([Encryptable.uint64(1000n)]).execute();
    const [salary2] = await fhe.encryptInputs([Encryptable.uint64(2000n)]).execute();

    // Add 1000 in ETH (0) and 2000 in USDC (1)
    await payroll.addEmployee(employee1Address, salary1, 0);
    await payroll.addEmployee(employee2Address, salary2, 1);

    const [ethTotal, usdcTotal] = await payroll.getEncryptedTotals();

    const decryptedETH = await fhe.decryptForView(ethTotal, FheTypes.Uint64).execute();
    const decryptedUSDC = await fhe.decryptForView(usdcTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(1000);
    expect(Number(decryptedUSDC)).to.equal(2000);
  });

  it("5. Handles large numbers correctly (no overflow issues)", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const maxUint64 = 4294967295n; 

    const [largeSalary] = await fhe.encryptInputs([Encryptable.uint64(maxUint64)]).execute();

    await payroll.addEmployee(employee1Address, largeSalary, 0);

    const [ethTotal] = await payroll.getEncryptedTotals();
    const decryptedETH = await fhe.decryptForView(ethTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(Number(maxUint64));
  });

  it("6. Prevents double withdrawal", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

    await payroll.addEmployee(employee1Address, encryptedSalary, 0);

    await payroll.connect(employee1).withdrawSalary();

    await expect(
      payroll.connect(employee1).withdrawSalary()
    ).to.be.revertedWith("No salary to withdraw");
  });

  it("7. Should return the list of added employees using getEmployees()", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();

    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const [salary1] = await fhe.encryptInputs([Encryptable.uint64(1000n)]).execute();
    const [salary2] = await fhe.encryptInputs([Encryptable.uint64(2000n)]).execute();

    await payroll.addEmployee(employee1Address, salary1, 0);
    await payroll.addEmployee(employee2Address, salary2, 1);

    const employees = await payroll.getEmployees();

    expect(employees.length).to.equal(2);
    expect(employees[0]).to.equal(employee1Address);
    expect(employees[1]).to.equal(employee2Address);
  });

  it("8. Should revert if non-owner tries to add employee", async function () {
    const fhe = await hre.cofhe.createClientWithBatteries();
    const employee1Address = await employee1.getAddress();
    
    const [encryptedSalary] = await fhe.encryptInputs([Encryptable.uint64(5000n)]).execute();

    await expect(
      payroll.connect(employee1).addEmployee(employee1Address, encryptedSalary, 0)
    ).to.be.revertedWith("Only owner can call this");
  });

  it("9. Should revert if non-owner tries to process payroll", async function () {
    await expect(
      payroll.connect(employee1).processPayroll()
    ).to.be.revertedWith("Only owner can call this");
  });

  it("10. Employee can decrypt their own salary", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheEmployee = await hre.cofhe.createClientWithBatteries(employee1);
    
    const employee1Address = await employee1.getAddress();

    const [encryptedSalary] = await fheOwner.encryptInputs([Encryptable.uint64(7500n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedSalary, 0);

    const storedSalary = await payroll.salaries(employee1Address);

    const decrypted = await fheEmployee.decryptForView(storedSalary, FheTypes.Uint64).execute();
    expect(Number(decrypted)).to.equal(7500);
  });

  it("11. Unauthorized user cannot decrypt someone else's salary or totals", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheEmployee2 = await hre.cofhe.createClientWithBatteries(employee2);
    
    const employee1Address = await employee1.getAddress();
    
    const [encryptedSalary] = await fheOwner.encryptInputs([Encryptable.uint64(5000n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedSalary, 0);

    const storedSalary = await payroll.salaries(employee1Address);
    const [ethTotal] = await payroll.getEncryptedTotals();

    // Employee 2 tries to decrypt Employee 1's salary
    let salaryErrorOccurred = false;
    try {
      await fheEmployee2.decryptForView(storedSalary, FheTypes.Uint64).execute();
    } catch (error) {
      salaryErrorOccurred = true;
    }
    expect(salaryErrorOccurred).to.be.true;

    // Employee 2 tries to decrypt the total payroll
    let totalErrorOccurred = false;
    try {
      await fheEmployee2.decryptForView(ethTotal, FheTypes.Uint64).execute();
    } catch (error) {
      totalErrorOccurred = true;
    }
    expect(totalErrorOccurred).to.be.true;
  });

  it("12. Employer (owner) can successfully decrypt total payroll aggregates", async function () {
    const fheEmployer = await hre.cofhe.createClientWithBatteries(owner);
    
    const employee1Address = await employee1.getAddress();
    const employee2Address = await employee2.getAddress();

    const [salary1] = await fheEmployer.encryptInputs([Encryptable.uint64(3000n)]).execute();
    const [salary2] = await fheEmployer.encryptInputs([Encryptable.uint64(4500n)]).execute();

    // Both in ETH
    await payroll.addEmployee(employee1Address, salary1, 0);
    await payroll.addEmployee(employee2Address, salary2, 0);

    const [ethTotal] = await payroll.getEncryptedTotals();

    const decryptedETH = await fheEmployer.decryptForView(ethTotal, FheTypes.Uint64).execute();
    
    expect(Number(decryptedETH)).to.equal(7500); // 3000 + 4500 = 7500
  });

  // -------------------------------------------------------------------------
  // Compliance & Privara Settlement Tests
  // -------------------------------------------------------------------------

  it("13. Should allow owner to add Compliance Officer", async function () {
    const complianceAddress = await complianceOfficer.getAddress();

    // Add Compliance Officer
    await expect(payroll.addCompliance(complianceAddress))
      .to.emit(payroll, "ComplianceAdded")
      .withArgs(complianceAddress);
      
    expect(await payroll.isCompliance(complianceAddress)).to.be.true;
  });

  it("14. Selective Disclosure: Compliance Officer can NOT decrypt individual salaries", async function () {
    const fheOwner = await hre.cofhe.createClientWithBatteries(owner);
    const fheCompliance = await hre.cofhe.createClientWithBatteries(complianceOfficer);
    
    const employee1Address = await employee1.getAddress();
    const complianceAddress = await complianceOfficer.getAddress();

    // 1. Owner adds an employee with an ETH salary
    const [encryptedSalary] = await fheOwner.encryptInputs([Encryptable.uint64(8200n)]).execute();
    await payroll.addEmployee(employee1Address, encryptedSalary, 0);

    // 2. Owner assigns the compliance role. 
    await payroll.addCompliance(complianceAddress);

    // 4. Compliance Officer attempts to decrypt the individual employee's salary
    const storedSalary = await payroll.salaries(employee1Address);
    
    let unauthorizedAccessCaught = false;
    try {
      await fheCompliance.decryptForView(storedSalary, FheTypes.Uint64).execute();
    } catch (error) {
      unauthorizedAccessCaught = true;
    }
    
    expect(unauthorizedAccessCaught).to.be.true;
  });

  it("15. Should allow owner to deploy and set escrow in one transaction", async function () {
    // Using employee addresses as mock token addresses for the test
    const dummyTokenETH = await employee1.getAddress();
    const dummyTokenUSDC = await employee2.getAddress();

    // Verify it starts as zero address
    expect(await payroll.privaraEscrow()).to.equal(hre.ethers.ZeroAddress);

    // Call deployAndSetEscrow
    const tx = await payroll.deployAndSetEscrow(dummyTokenETH, dummyTokenUSDC);
    
    // Fetch the newly deployed escrow address
    const newEscrowAddress = await payroll.privaraEscrow();
    expect(newEscrowAddress).to.not.equal(hre.ethers.ZeroAddress);

    // Verify it emitted the PrivaraEscrowSet event
    await expect(tx)
      .to.emit(payroll, "PrivaraEscrowSet")
      .withArgs(newEscrowAddress);
      
    // Verify it reverts if trying to deploy again
    await expect(
      payroll.deployAndSetEscrow(dummyTokenETH, dummyTokenUSDC)
    ).to.be.revertedWith("Escrow already deployed");
  });

  it("16. Should revert if non-owner tries to deploy and set escrow", async function () {
    const dummyTokenETH = await employee1.getAddress();
    const dummyTokenUSDC = await employee2.getAddress();

    // Attempt to call as employee1
    await expect(
      payroll.connect(employee1).deployAndSetEscrow(dummyTokenETH, dummyTokenUSDC)
    ).to.be.revertedWith("Only owner can call this");
  });
});