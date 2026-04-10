import { task } from "hardhat/config";

task("interact", "Deploys and runs Confidro payroll flow")
  .setAction(async (_, hre) => {
    const [owner, employee1, employee2] = await hre.ethers.getSigners();

    // Deploy contract
    const ConfidroPayroll = await hre.ethers.getContractFactory("ConfidroPayroll");
    const payroll = await ConfidroPayroll.deploy();
    await payroll.waitForDeployment();

    const contractAddress = await payroll.getAddress();
    console.log("✅ Contract deployed to:", contractAddress);

    // Load FHE plugin
    const fhe = require("@fhenixprotocol/cofhe-hardhat-plugin").fhe;

    // Encrypt salaries
    const salary1 = await fhe.encrypt32(1000);
    const salary2 = await fhe.encrypt32(2000);

    // Add employees
    await payroll.addEmployee(await employee1.getAddress(), salary1);
    await payroll.addEmployee(await employee2.getAddress(), salary2);
    console.log("👥 Employees added");

    // Process payroll
    await payroll.processPayroll();
    console.log("💸 Payroll processed");

    // Get total payroll (decrypted)
    const total = await payroll.getDecryptedTotal();
    console.log("📊 Total payroll (decrypted):", total.toString());
  });