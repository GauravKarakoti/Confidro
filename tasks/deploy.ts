import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'
import { AaveV3BaseSepolia } from "@aave-dao/aave-address-book";

task('deploy', 'Deploy the contracts').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre

    console.log(`Deploying contracts to ${network.name}...`)

    const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; 
    const BASE_SEPOLIA_WETH = "0x4200000000000000000000000000000000000006";
    const UNI_ROUTER = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";
    const UNI_POSITION_MANAGER = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2";

    const UniswapAdapterVault = await ethers.getContractFactory('UniswapAdapterVault');
    
    console.log("Deploying Uniswap Vault Adapters...");
    const uniAdapterUSDC = await UniswapAdapterVault.deploy(
        "Confidro UniV3 USDC Receipt", "cuUSDC",
        BASE_SEPOLIA_USDC, BASE_SEPOLIA_WETH, UNI_ROUTER, UNI_POSITION_MANAGER
    );
    await uniAdapterUSDC.waitForDeployment();
    
    const uniAdapterWETH = await UniswapAdapterVault.deploy(
        "Confidro UniV3 WETH Receipt", "cuWETH",
        BASE_SEPOLIA_WETH, BASE_SEPOLIA_USDC, UNI_ROUTER, UNI_POSITION_MANAGER
    );
    await uniAdapterWETH.waitForDeployment();

    console.log(`Uni USDC Adapter: ${uniAdapterUSDC.target}`);
    console.log(`Uni WETH Adapter: ${uniAdapterWETH.target}`);

    console.log("Deploying Uniswap Master Adapter...");
    const UniswapMasterAdapter = await ethers.getContractFactory('UniswapMasterAdapter');
    const uniMasterAdapter = await UniswapMasterAdapter.deploy(
        BASE_SEPOLIA_USDC, BASE_SEPOLIA_WETH, uniAdapterUSDC.target, uniAdapterWETH.target
    );
    await uniMasterAdapter.waitForDeployment();
    console.log(`Uni Master Adapter: ${uniMasterAdapter.target}`);
    
    saveDeployment(network.name, 'UniswapMasterAdapter', await uniMasterAdapter.getAddress())

    // const COMP_CUSDCV3 = "0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017"; 
    // const COMP_CWETHV3 = "0x61490650AbaA31393464C3f34E8B29cd1C44118E";

    // console.log("Deploying Compound Master Adapter...");
    // const CompoundMasterAdapter = await ethers.getContractFactory('CompoundMasterAdapter');
    // const compAdapter = await CompoundMasterAdapter.deploy(
    //     BASE_SEPOLIA_USDC, BASE_SEPOLIA_WETH, COMP_CUSDCV3, COMP_CWETHV3
    // );
    // await compAdapter.waitForDeployment();
    // console.log(`Compound Master Adapter: ${compAdapter.target}`);

    // saveDeployment(network.name, 'CompoundMasterAdapter', await compAdapter.getAddress())

    console.log("Deploying Curve Master Adapter...");
    const CURVE_ADDRESS_PROVIDER = "0x0000000022D53366457F9d5E68Ec105046FC4383";
    const providerAbi = ["function get_address(uint256 id) view returns (address)"];
    const registryAbi = ["function find_pool_for_coins(address _from, address _to) view returns (address)"];
    
    let curvePoolAddress = ethers.ZeroAddress;
    try {
        const addressProvider = await ethers.getContractAt(providerAbi, CURVE_ADDRESS_PROVIDER);
        const registryAddress = await addressProvider.get_address(0);
        if (registryAddress !== ethers.ZeroAddress) {
            const registry = await ethers.getContractAt(registryAbi, registryAddress);
            curvePoolAddress = await registry.find_pool_for_coins(BASE_SEPOLIA_USDC, BASE_SEPOLIA_WETH);
        }
    } catch (e) {
        console.log("AddressProvider not found or error fetching live Curve pool.");
    }

    if (curvePoolAddress === ethers.ZeroAddress) {
        console.log("No live Curve pool found on Base Sepolia. Deploying MockCurvePool...");
        
        const MockCurvePool = await ethers.getContractFactory('MockCurvePool');
        const mockCurvePool = await MockCurvePool.deploy();
        await mockCurvePool.waitForDeployment();
        
        curvePoolAddress = await mockCurvePool.getAddress();
        console.log(`Mock Curve Pool deployed at: ${curvePoolAddress}`);
    } else {
        console.log(`Live Curve Pool found at: ${curvePoolAddress}`);
    }

    const CurveMasterAdapter = await ethers.getContractFactory('CurveMasterAdapter');
    
    const curveAdapter = await CurveMasterAdapter.deploy(
        BASE_SEPOLIA_USDC, 
        BASE_SEPOLIA_WETH, 
        curvePoolAddress,
        curvePoolAddress
    );
    await curveAdapter.waitForDeployment();
    console.log(`Curve Master Adapter: ${curveAdapter.target}`);

    saveDeployment(network.name, 'CurveMasterAdapter', await curveAdapter.getAddress())

    console.log("Deploying FHE Wrappers for Uniswap, Compound, & Curve...");
    const FHERC20Wrapper = await ethers.getContractFactory('FHERC20Wrapper');
    
    const wrapperUniUSDC = await FHERC20Wrapper.deploy(uniAdapterUSDC.target, 6, false);
    await wrapperUniUSDC.waitForDeployment();
    const wrapperUniWETH = await FHERC20Wrapper.deploy(uniAdapterWETH.target, 18, true);
    await wrapperUniWETH.waitForDeployment();

    saveDeployment(network.name, 'WrapperUniUSDC', await wrapperUniUSDC.getAddress())
    saveDeployment(network.name, 'WrapperUniWETH', await wrapperUniWETH.getAddress())

    // const wrapperCompUSDC = await FHERC20Wrapper.deploy(COMP_CUSDCV3, 6, false);
    // await wrapperCompUSDC.waitForDeployment();
    // const wrapperCompWETH = await FHERC20Wrapper.deploy(COMP_CWETHV3, 18, true);
    // await wrapperCompWETH.waitForDeployment();

    // saveDeployment(network.name, 'WrapperCompUSDC', await wrapperCompUSDC.getAddress())
    // saveDeployment(network.name, 'WrapperCompWETH', await wrapperCompWETH.getAddress())

    const wrapperCurveUSDC = await FHERC20Wrapper.deploy(curveAdapter.target, 6, false);
    await wrapperCurveUSDC.waitForDeployment();
    const wrapperCurveWETH = await FHERC20Wrapper.deploy(curveAdapter.target, 18, true);
    await wrapperCurveWETH.waitForDeployment();

    saveDeployment(network.name, 'WrapperCurveUSDC', await wrapperCurveUSDC.getAddress())
    saveDeployment(network.name, 'WrapperCurveWETH', await wrapperCurveWETH.getAddress())


    // console.log("Deploying FHE Wrappers using Real Aave V3 aTokens...");
    
    // const aWETHAddress = AaveV3BaseSepolia.ASSETS.WETH.A_TOKEN;
    // const aUSDCAddress = AaveV3BaseSepolia.ASSETS.USDC.A_TOKEN;
    // const aavePoolAddress = AaveV3BaseSepolia.POOL;
    
    // console.log(`Live Aave Pool configured at: ${aavePoolAddress}`);

    // const wrapperAaveETH = await FHERC20Wrapper.deploy(aWETHAddress, 18, true);
    // await wrapperAaveETH.waitForDeployment();
    
    // const wrapperAaveUSDC = await FHERC20Wrapper.deploy(aUSDCAddress, 6, false);
    // await wrapperAaveUSDC.waitForDeployment();

    // console.log(`WrapperAaveETH: ${wrapperAaveETH.target} | WrapperAaveUSDC: ${wrapperAaveUSDC.target}`);

    // saveDeployment(network.name, 'WrapperAaveETH', await wrapperAaveETH.getAddress())
    // saveDeployment(network.name, 'WrapperAaveUSDC', await wrapperAaveUSDC.getAddress())

    console.log("Deploying Confidro Payroll Factory...");
    const ConfidroPayrollFactory = await ethers.getContractFactory('ConfidroPayrollFactory')
    const payrollFactory = await ConfidroPayrollFactory.deploy()
    await payrollFactory.waitForDeployment()

    console.log(`Factory deployed to: ${payrollFactory.target}`)
    saveDeployment(network.name, 'ConfidroPayrollFactory', await payrollFactory.getAddress())

    return {
        // AavePool: aavePoolAddress,
        // WrapperAaveETH: wrapperAaveETH.target,
        // WrapperAaveUSDC: wrapperAaveUSDC.target,

        UniAdapterUSDC: uniAdapterUSDC.target,
        UniAdapterWETH: uniAdapterWETH.target,
        UniswapMasterAdapter: uniMasterAdapter.target,
        WrapperUniUSDC: wrapperUniUSDC.target,
        WrapperUniWETH: wrapperUniWETH.target,

        // CompAdapter: compAdapter.target,
        // WrapperCompUSDC: wrapperCompUSDC.target,
        // WrapperCompWETH: wrapperCompWETH.target,

        CurveAdapter: curveAdapter.target,
        WrapperCurveUSDC: wrapperCurveUSDC.target,
        WrapperCurveWETH: wrapperCurveWETH.target,
        
        ConfidroPayrollFactory: payrollFactory.target
    }
})