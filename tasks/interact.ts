import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("interact", "Runs Confidro payroll flow on a deployed contract")
  .addParam("contract", "The address of the deployed ConfidroPayroll contract")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const [owner, employee1, employee2] = await hre.ethers.getSigners();
    const contractAddress = taskArgs.contract;

    console.log(`✅ Interacting with contract at: ${contractAddress}`);

    // Connect to the deployed contract
    const ConfidroPayroll = await hre.ethers.getContractFactory("ConfidroPayroll");
    const payroll = ConfidroPayroll.attach(contractAddress);

    // Load FHE plugin
    const fhe = require("@fhenixprotocol/cofhe-hardhat-plugin").fhe;

    // Encrypt salaries
    console.log("🔒 Encrypting salaries...");
    const salary1 = await fhe.encrypt32(1000);
    const salary2 = await fhe.encrypt32(2000);

    // Add employees
    console.log("👥 Adding employees...");
    
    const tx1 = await payroll.addEmployee(await employee1.getAddress(), salary1);
    await tx1.wait();
    
    const tx2 = await payroll.addEmployee(await employee2.getAddress(), salary2);
    await tx2.wait();
    
    console.log("✅ Employees added successfully");

    // Process payroll
    console.log("💸 Processing payroll...");
    const tx3 = await payroll.processPayroll();
    await tx3.wait();
    console.log("✅ Payroll processed");

    // Get total payroll 
    // Note: FHE view functions return encrypted data. Depending on your plugin configuration, 
    // you may need to call an explicit unseal/decrypt method on this returned value.
    const total = await payroll.getEncryptedTotal();
    console.log("📊 Total payroll (Encrypted Buffer):", total.toString());
  });