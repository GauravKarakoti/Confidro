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
	// const Counter = await ethers.getContractFactory('Counter')
	// const counter = await Counter.deploy()
	// await counter.waitForDeployment()

	// const counterAddress = await counter.getAddress()
	// console.log(`Counter deployed to: ${counterAddress}`)

	// Save the deployment
	// saveDeployment(network.name, 'Counter', counterAddress)
	
	const addresses = {
		// Counter: counterAddress
	}

	return addresses
})
