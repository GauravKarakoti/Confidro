import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

task('deploy', 'Deploy the contracts').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
	const { ethers, network } = hre

	console.log(`Deploying contracts to ${network.name}...`)

	// const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; 
	// const BASE_SEPOLIA_WETH = "0x4200000000000000000000000000000000000006";

	// console.log("Deploying Mock Aave Pool & aTokens...");
    // const MockAavePool = await ethers.getContractFactory('MockAavePool');
    // const aavePool = await MockAavePool.deploy();
    // await aavePool.waitForDeployment();
    // console.log(`MockAavePool deployed to: ${aavePool.target}`);

    // const MockERC20 = await ethers.getContractFactory('MockERC20');
    
    // const mockAWETH = await MockERC20.deploy("Mock Aave WETH", "aWETH", 18);
    // await mockAWETH.waitForDeployment();
    
    // const mockAUSDC = await MockERC20.deploy("Mock Aave USDC", "aUSDC", 6);
    // await mockAUSDC.waitForDeployment();

    // console.log("Initializing Mock Aave Reserves...");
    // await aavePool.initReserve(BASE_SEPOLIA_WETH, mockAWETH.target);
    // await aavePool.initReserve(BASE_SEPOLIA_USDC, mockAUSDC.target);

    // console.log("Deploying FHE Wrappers using Mock aTokens...");
    // const FHERC20Wrapper = await ethers.getContractFactory('FHERC20Wrapper');
    
    // const wrapperETH = await FHERC20Wrapper.deploy(mockAWETH.target, 18, true);
    // await wrapperETH.waitForDeployment();
    
    // const wrapperUSDC = await FHERC20Wrapper.deploy(mockAUSDC.target, 6, false);
    // await wrapperUSDC.waitForDeployment();

    // console.log(`WrapperETH: ${wrapperETH.target} | WrapperUSDC: ${wrapperUSDC.target}`);

    const ConfidroPayrollFactory = await ethers.getContractFactory('ConfidroPayrollFactory')
    const payrollFactory = await ConfidroPayrollFactory.deploy()
    await payrollFactory.waitForDeployment()

    console.log(`Factory deployed to: ${payrollFactory.target}`)

    // saveDeployment(network.name, 'MockAavePool', await aavePool.getAddress())
    // saveDeployment(network.name, 'WrapperETH', await wrapperETH.getAddress())
    // saveDeployment(network.name, 'WrapperUSDC', await wrapperUSDC.getAddress())
    saveDeployment(network.name, 'ConfidroPayrollFactory', await payrollFactory.getAddress())

    return {
        // MockAavePool: aavePool.target,
        // WrapperETH: wrapperETH.target,
        // WrapperUSDC: wrapperUSDC.target,
        ConfidroPayrollFactory: payrollFactory.target
    }
})