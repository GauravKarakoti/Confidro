// frontend/app/api/agent/route.ts
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { riskPreference } = await req.json();

        // 1. Fetch live market data from DefiLlama Yields API
        let marketData = "Live market data currently unavailable.";
        try {
            const response = await fetch('https://yields.llama.fi/pools');
            const data = await response.json();

            // Filter for some popular pools (Ethereum mainnet as baseline)
            const aaveUSDC = data.data.find((p: any) => p.project === 'aave-v3' && p.symbol === 'USDC' && p.chain === 'Ethereum');
            const compUSDC = data.data.find((p: any) => p.project === 'compound-v3' && p.symbol === 'USDC' && p.chain === 'Ethereum');
            const curve3Pool = data.data.find((p: any) => p.project === 'curve-dex' && p.symbol === '3CRV');
            const uniETHUSDC = data.data.find((p: any) => p.project === 'uniswap-v3' && p.symbol === 'USDC-WETH' && p.chain === 'Ethereum');

            marketData = `
                Current Live DeFi Yields:
                - Aave v3 USDC: ${aaveUSDC ? aaveUSDC.apy.toFixed(2) : 4.2}% APY (Low Risk)
                - Compound v3 USDC: ${compUSDC ? compUSDC.apy.toFixed(2) : 3.8}% APY (Low Risk)
                - Uniswap USDC/ETH LP: ${uniETHUSDC ? uniETHUSDC.apy.toFixed(2) : 12.5}% APY (High Risk, IL exposure)
                - Curve 3Pool: ${curve3Pool ? curve3Pool.apy.toFixed(2) : 5.1}% APY (Medium Risk)
            `;
        } catch (fetchError) {
            console.error("Failed to fetch DefiLlama data, using fallback.", fetchError);
        }

        // 2. Construct the prompt for Groq
        const prompt = `
        You are a Confidential AI DeFi Agent for the Confidro payroll protocol.
        The user wants to allocate their encrypted streaming salary into DeFi protocols.
        Their requested risk preference is: "${riskPreference}".
        
        Based on this live market data: ${marketData}
        
        Recommend a portfolio allocation strategy.
        Respond STRICTLY in JSON format. The keys should be the protocol names (lowercase) and the values should be integer percentages that sum to exactly 100.
        Example format: {"aave": 50, "compound": 50, "uniswap": 0, "curve": 0}
        `;

        // 3. Ultra-fast inference via Groq
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant', 
            response_format: { type: 'json_object' },
            temperature: 0.2,
        });

        const strategy = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');

        return NextResponse.json({ success: true, strategy });
    } catch (error) {
        console.error("AI Agent Error:", error);
        return NextResponse.json(
            { success: false, error: 'Agent execution failed' }, 
            { status: 500 }
        );
    }
}