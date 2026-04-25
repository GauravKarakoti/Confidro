import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

// Task to deploy the contracts
task('deploy', 'Deploy the contracts to the selected network').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
	const { ethers, network } = hre

	console.log(`Deploying contracts to ${network.name}...`)

	// Get the deployer account
	const [deployer] = await ethers.getSigners()
	console.log(`Deploying with account: ${deployer.address}`)

	// Deploy the contract
	const ConfidroPayrollFactory = await ethers.getContractFactory('ConfidroPayrollFactory')
	const payrollFactory = await ConfidroPayrollFactory.deploy()
	await payrollFactory.waitForDeployment()

	const contractAddress = await payrollFactory.getAddress()
	console.log(`ConfidroPayrollFactory deployed to: ${contractAddress}`)

	// Save the deployment
	saveDeployment(network.name, 'ConfidroPayrollFactory', contractAddress)
	
	const addresses = {
		ConfidroPayrollFactory: contractAddress
	}

	return addresses
})