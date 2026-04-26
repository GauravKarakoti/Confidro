@AGENTS.md

## ReineiraOS Protocol Integration
This project integrates with ReineiraOS. You have access to the ReineiraOS MCP server. When I ask you to build or interact with smart contracts, escrow, or plugins, use the following tools:
- `get_docs` / `search_docs`: To find implementation guides and protocol references.
- `get_contracts`: To fetch the latest deployed addresses on Arbitrum Sepolia (e.g., Escrow, Insurance).
- `get_interfaces`: To pull Solidity source code for `IConditionResolver` or `IUnderwriterPolicy` before implementing them.
- `get_platform_version`: To ensure compiler settings match the platform.

Always fetch the latest interfaces and contract addresses using these tools rather than relying on your training data.