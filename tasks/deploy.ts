import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

task('deploy', 'Deploy the contracts').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
	const { ethers, network } = hre

	console.log(`Deploying contracts to ${network.name}...`)

	// const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; 
	// const BASE_SEPOLIA_WETH = "0x4200000000000000000000000000000000000006";

	// console.log("Deploying FHE Wrappers...");
	// const FHERC20Wrapper = await ethers.getContractFactory('FHERC20Wrapper')
	
	// const wrapperETH = await FHERC20Wrapper.deploy(BASE_SEPOLIA_WETH, 18, true)
	// await wrapperETH.waitForDeployment()
	
	// const wrapperUSDC = await FHERC20Wrapper.deploy(BASE_SEPOLIA_USDC, 6, false)
	// await wrapperUSDC.waitForDeployment()

	// console.log(`WrapperETH: ${wrapperETH.target} | WrapperUSDC: ${wrapperUSDC.target}`)

	const ConfidroPayrollFactory = await ethers.getContractFactory('ConfidroPayrollFactory')
	const payrollFactory = await ConfidroPayrollFactory.deploy()
	await payrollFactory.waitForDeployment()

	console.log(`Factory deployed to: ${payrollFactory.target}`)

	// saveDeployment(network.name, 'WrapperETH', await wrapperETH.getAddress())
	// saveDeployment(network.name, 'WrapperUSDC', await wrapperUSDC.getAddress())
	saveDeployment(network.name, 'ConfidroPayrollFactory', await payrollFactory.getAddress())

	return {
		// WrapperETH: wrapperETH.target,
		// WrapperUSDC: wrapperUSDC.target,
		ConfidroPayrollFactory: payrollFactory.target
	}
})