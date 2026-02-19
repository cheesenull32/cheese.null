
# Replace README.md with a Clean Contract Overview

## Problem
The current `README.md` is entirely Lovable boilerplate -- project URLs, IDE instructions, deployment guides -- none of which is relevant to someone browsing the contract on GitHub. It needs to be replaced with a simple plain-English explanation of what the `cheeseburner` contract does.

## Solution
Rewrite `README.md` from scratch with no Lovable references. Keep it brief and non-technical: what the contract is, what it does, and the basic flow.

## New README Content

```
# cheeseburner

A WAX smart contract that claims voting rewards and uses them to burn CHEESE tokens.

## What it does

1. Anyone can call the `burn` action to trigger a burn cycle.
2. The contract claims its accumulated WAX voting rewards from the WAX blockchain.
3. 20% of the claimed WAX is staked back as CPU to maintain vote weight.
4. The remaining 80% is swapped for CHEESE via the Alcor AMM (pool #1252).
5. Of the CHEESE received:
   - ~78.75% is sent to `eosio.null` (permanently burned)
   - ~12.5% is sent to the caller as a reward for triggering the burn
   - ~8.75% is sent to `xcheeseliqst` for liquidity
6. A `logburn` action is recorded to the caller's transaction history for transparency.

## Cooldown

The WAX voting reward claim has a 24-hour cooldown enforced by the `eosio` system contract. The burn action will fail if called before the cooldown has elapsed.

## Contract accounts

| Account | Role |
|---|---|
| `cheeseburner` | This contract |
| `cheeseburger` | CHEESE token contract |
| `swap.alcor` | Alcor AMM swap contract |
| `eosio.null` | Burn destination |
| `xcheeseliqst` | Liquidity allocation account |
```

## File to Modify
- **`README.md`**: Replace entire contents with the above.

This is a single-file, content-only change with no code impact whatsoever.
