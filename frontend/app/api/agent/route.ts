import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { riskPreference } = await req.json();

        // 1. Fetch live market data (Mocked here for demonstration)
        const marketData = `
            Current DeFi Yields:
            - Aave v3 USDC: 4.2% APY (Low Risk)
            - Compound v3 USDC: 3.8% APY (Low Risk)
            - Uniswap USDC/ETH LP: 12.5% APY (High Risk, Impermanent Loss exposure)
            - Curve 3Pool: 5.1% APY (Medium Risk)
        `;

        // 2. Construct the prompt for Groq
        const prompt = `
        You are a Confidential AI DeFi Agent for the Confidro payroll protocol.
        The user wants to allocate their encrypted streaming salary into DeFi protocols.
        Their requested risk preference is: "${riskPreference}".
        
        Based on this market data: ${marketData}
        
        Recommend a portfolio allocation strategy.
        Respond STRICTLY in JSON format. The keys should be the protocol names (lowercase) and the values should be integer percentages that sum to exactly 100.
        Example format: {"aave": 50, "compound": 50, "uniswap": 0, "curve": 0}
        `;

        // 3. Ultra-fast inference via Groq
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant', // Fast, efficient model for JSON structuring
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