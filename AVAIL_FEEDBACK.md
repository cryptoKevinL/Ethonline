# AVAIL Framework Feedback

This document contains feedback, issues, and suggestions for the AVAIL team based on our experience building PayStream - a Web3 payment management system.

## Project Overview

**Project**: PayStream - Web3 Payment Management System  
**Use Case**: Employer-employee payment processing with cross-chain capabilities  
**Framework**: AVAIL Framework with Nexus SDK integration  

### Documentation Questions

### Issue 0: Confusion About Token Conversion in `transfer()` Function

**Context:**  
While testing the `transfer()` method of the Avail Nexus SDK, there was confusion about how token conversion actually works when sending assets cross-chain.

At the very top of the docs, the description says:

> “Use the transfer() function to convert multiple tokens from multiple chains to a single token on a single chain.”

This statement led me to believe that if I only had **ETH** on the source chain (e.g., **Sepolia**) and I wanted to receive **USDC** on the destination chain (e.g., **Base**), the SDK would automatically handle the conversion from **ETH → USDC** before bridging.

---

**Example Code Used:**
```bash

typescript
const result: TransferResult = await sdk.transfer({
  token: 'USDC', // Convert selected tokens to USDC
  amount: 100,
  chainId: 84532, // Base Sepolia
  recipient: '0x...',
  sourceChains: [11155111], //only uses ETH from Sepolia
});
```

Expected Behavior (Based on Docs):

The SDK would use ETH from Sepolia (since that’s what the sender holds).

It would automatically convert that ETH into USDC and send it to the receiver on Base.

Actual Behavior (Confirmed by Avail Team on Discord):

The SDK does not automatically perform token conversion from ETH → USDC.

The sender must already have USDC on the source chain.

The documentation was confirmed to be incorrect and will be updated.

Clarification from Avail Team (RobinRRT):

“This is actually wrong in the docs. We need to update it.
It takes a single token from multiple sources and sends it to the receiver.
What you are looking to do might require the XCS swap feature (Swap with exactOut + Transfer USDC).”

Feedback & Suggestions:

The documentation should clearly state that the transfer() method does not swap tokens — it only aggregates existing balances of the same token across multiple chains for transfer.

The line “Convert selected tokens to USDC” should be revised to “Transfers an existing supported token (e.g., USDC) from one or multiple source chains to the destination chain.”

Add a cross-reference to the XCS Swap (exactOut) section for developers looking to convert one token (e.g., ETH) into another (e.g., USDC) and transfer it in one step.

### Issue 1: Question on Allowances and Order of Operations 
```
How Allowances Work?
Here is how the allowances enables chain abstracted transactions:

User approves the protocol to access funds from two or more source chains.
Protocol unifies user balance across these chains.
Unified funds go into protocol vaults.
The protocol presents the user with an intent to transact on the destination along with amount and fee details.
```

When you say `unified funds go into protocol vaults` does the users wallet get emptied of a token type and put into protocol vaults?  Or is it just the amount of the transaction?  I was a bit confused because the default allowance is unlimited, I assume its just the transaction amount but wasn't 100% sure here.  I had some thoughts that maybe Avail Nexus became a full wallet custodian for a given wallet so that while the users funds were "SAFU" - Avail Nexus held the $ in numerous smart contracts such that they don't need to pay gas for the initial Payer->Nexus/Solver transfer.

### Issue 1.1
Do you have an easy way for users to revoke all allowances in the event of a security issue?  Or should each app provide that capability?  
We did find a line of code: `//Revoke allowances await sdk.revokeAllowance(137, ['USDC']);` - I think some comment elsewhere about revokation would be useful.


### Issue 2: Traceability and Error Handling of Transactions
Right now its a bit cloudy on what happens with a TX in typical blockchain scenarios:
2a) "Race Conditions" - after simulation is it gauranteed the liqudity is still there?
   For Example, what if liquidty is gone because because between simulation and actual execution another TX happens?
2b) Documenting what is atomic across the end to end TX process vs what is not is really essential for developers and corporate legal useage.
2c) In Discord we were told if the Solver->Payee TX fails, the $ is sent back to the original sender shortly after.  This was not in the documentation, something very critical that needs to be added
  2c..continued) What if between the time the Solver->Payee fail, liquidity drops below what is needed for a refund.  You should explain that user funds are locked in the code until the Solver->Payee TX is completed and can't be re-used for general liquidy immediately.... Is there a Smart Contract audit which shows this is scenario is covered/safe?  

### Issue 3: Incorrect USDT Contract Addresses in SDK

**Problem**: During development, we encountered a "Token not supported on this chain" error when trying to transfer USDT on Sepolia testnet.

**Root Cause**: The AVAIL SDK contained incorrect USDT contract addresses for several testnets:
- Optimism Sepolia USDT address was incorrect and USDT was not supported on sepolia while it said it was on the sdk
- Multiple token addresses in the constants file were outdated or pointing to EOA addresses

**Evidence**: 
- Screenshot shows transfer failing with "Token not supported on this chain" error
- Comparison between SDK addresses and actual verified contract addresses on testnet explorers revealed discrepancies
- The address `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` shown in SDK didn't match the actual USDT deployments

**Impact**: This blocked our development workflow and required manual investigation to identify the root cause.

**Resolution**: We reported this issue to the AVAIL team during the hackathon, and they promptly addressed it by merging a pull request that updated the incorrect USDT addresses across multiple testnets including Optimism Sepolia, Arbitrum Sepolia, and Monad Testnet.

**Pull Request**: [availproject/nexus-sdk#49](https://github.com/availproject/nexus-sdk/pull/49/commits/ea8850d7240bede57e98f1c7b6283ec85e47c86d)

### Issue 4: Where does it talk about simulation and details that will give us?

- when I search for "Simulation" on docs.avail.org there is no mention of what details I'll get, how to use it, etc.
<insert screen shot>
- when I search for "simulation" on github, its only mentioned in code, not the docs.
