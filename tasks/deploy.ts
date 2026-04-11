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
	const ConfidroPayroll = await ethers.getContractFactory('ConfidroPayroll')
	const payroll = await ConfidroPayroll.deploy()
	await payroll.waitForDeployment()

	const contractAddress = await payroll.getAddress()
	console.log(`ConfidroPayroll deployed to: ${contractAddress}`)

	// Save the deployment
	saveDeployment(network.name, 'ConfidroPayroll', contractAddress)
	
	const addresses = {
		ConfidroPayroll: contractAddress
	}

	return addresses
})