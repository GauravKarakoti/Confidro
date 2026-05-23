import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

task('deploy', 'Deploy the contracts').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
	const { ethers, network } = hre

	console.log(`Deploying contracts to ${network.name}...`)

	const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; 
	const BASE_SEPOLIA_WETH = "0x4200000000000000000000000000000000000006";
    const UNI_ROUTER = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";
    const UNI_POSITION_MANAGER = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2";

    const UniswapAdapterVault = await ethers.getContractFactory('UniswapAdapterVault');
    
    // 2. Deploy Adapter for USDC (Pairs USDC with WETH)
    const uniAdapterUSDC = await UniswapAdapterVault.deploy(
        "Confidro UniV3 USDC Receipt", "cuUSDC",
        BASE_SEPOLIA_USDC, BASE_SEPOLIA_WETH, UNI_ROUTER, UNI_POSITION_MANAGER
    );
    await uniAdapterUSDC.waitForDeployment();
    
    // 3. Deploy Adapter for WETH (Pairs WETH with USDC)
    const uniAdapterWETH = await UniswapAdapterVault.deploy(
        "Confidro UniV3 WETH Receipt", "cuWETH",
        BASE_SEPOLIA_WETH, BASE_SEPOLIA_USDC, UNI_ROUTER, UNI_POSITION_MANAGER
    );
    await uniAdapterWETH.waitForDeployment();

    console.log(`Uni USDC Adapter: ${uniAdapterUSDC.target}`);
    console.log(`Uni WETH Adapter: ${uniAdapterWETH.target}`);

    saveDeployment(network.name, 'UniAdapterUSDC', await uniAdapterUSDC.getAddress())
    saveDeployment(network.name, 'UniAdapterWETH', await uniAdapterWETH.getAddress())

    const FHERC20Wrapper = await ethers.getContractFactory('FHERC20Wrapper');
    const wrapperUniUSDC = await FHERC20Wrapper.deploy(uniAdapterUSDC.target, 6, false);
    await wrapperUniUSDC.waitForDeployment();

    // Deploy the FHE Wrapper for Uniswap WETH using the Adapter Vault as the underlying token
    const wrapperUniWETH = await FHERC20Wrapper.deploy(uniAdapterWETH.target, 18, true);
    await wrapperUniWETH.waitForDeployment();

    saveDeployment(network.name, 'WrapperUniUSDC', await wrapperUniUSDC.getAddress())
    saveDeployment(network.name, 'wrapperUniWETH', await wrapperUniWETH.getAddress())

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
        wrapperUniUSDC: wrapperUniUSDC.target,
        wrapperUniWETH: wrapperUniWETH.target,
        UniAdapterUSDC: uniAdapterUSDC.target,
        UniAdapterWETH: uniAdapterWETH.target,
        ConfidroPayrollFactory: payrollFactory.target
    }
})