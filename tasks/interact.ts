import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Encryptable } from "@cofhe/sdk";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/node";
import { baseSepolia } from "@cofhe/sdk/chains";

task("interact", "Runs Confidro payroll flow using the Factory pattern")
  .addParam("factory", "The address of the deployed ConfidroPayrollFactory contract")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    // 1. Grab the owner
    const [owner] = await hre.ethers.getSigners();
    const factoryAddress = taskArgs.factory;

    console.log(`✅ Interacting with Factory at: ${factoryAddress}`);

    // 2. Connect to the Factory contract
    const ConfidroPayrollFactory = await hre.ethers.getContractFactory("ConfidroPayrollFactory");
    const factory = ConfidroPayrollFactory.attach(factoryAddress);

    // 3. Create a new Organization (ConfidroPayroll contract) for the deployer
    console.log("🏭 Creating new organization payroll contract via Factory...");
    const createTx = await factory.createOrganization();
    await createTx.wait();

    // 4. Retrieve the newly created contract address for this employer
    const employerContracts = await factory.getContractsByEmployer(owner.address);
    // Get the most recent one we just deployed
    const payrollAddress = employerContracts[employerContracts.length - 1];
    console.log(`✅ New ConfidroPayroll deployed at: ${payrollAddress}`);

    // 5. Connect to the newly deployed Payroll Contract
    const ConfidroPayroll = await hre.ethers.getContractFactory("ConfidroPayroll");
    const payroll = ConfidroPayroll.attach(payrollAddress);

    // 6. Generate random addresses to act as your employees for the test
    const employee1Address = hre.ethers.Wallet.createRandom().address;
    const employee2Address = hre.ethers.Wallet.createRandom().address;

    // 7. Setup the FHE Client
    const config = createCofheConfig({
        environment: "node",
        supportedChains: [baseSepolia]
    });
    
    const fhe = createCofheClient(config);

    // Connect the FHE client to the transaction sender (owner)
    await hre.cofhe.connectWithHardhatSigner(fhe, owner);

    // Generate a permit so the owner can read encrypted view functions later
    console.log("📝 Generating self-permit...");
    await fhe.permits.createSelf({ issuer: await owner.getAddress() })

    console.log("🔒 Encrypting salaries...");
    const [salary1, salary2] = await fhe.encryptInputs([
        Encryptable.uint32(1000n),
        Encryptable.uint32(2000n)
    ]).execute();

    console.log("👥 Adding employees...");
    
    // Pass the entire salary object (which maps to the inEuint32 struct)
    const tx1 = await payroll.addEmployee(employee1Address, salary1);
    await tx1.wait();
    
    const tx2 = await payroll.addEmployee(employee2Address, salary2);
    await tx2.wait();
    
    console.log("✅ Employees added successfully");

    // Process payroll
    console.log("💸 Processing payroll...");
    const tx3 = await payroll.processPayroll();
    await tx3.wait();
    console.log("✅ Payroll processed");

    // Get total payroll 
    const total = await payroll.getEncryptedTotal();
    console.log("📊 Total payroll (Encrypted Buffer):", total.toString());
  });