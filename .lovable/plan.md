
# Remove Caller Reward — Redirect 10% to xCHEESE Liquidity

## Summary
Remove the 10% caller reward entirely to eliminate bot incentive. The 10% previously sent to the caller will now go to `xcheeseliqst` (xCHEESE liquidity), making that allocation 17% of swapped CHEESE instead of 7%.

## New Distribution Model

| Destination | Old | New |
|---|---|---|
| Burned to eosio.null | 63% of original value (78.75% of CHEESE) | unchanged |
| xCHEESE liquidity | 7% of original value (8.75% of CHEESE) | **17% of original value (21.25% of CHEESE)** |
| Caller reward | 10% of original value (12.5% of CHEESE) | **removed** |
| WAX staked to CPU | 20% of WAX | unchanged |

## Contract Changes (`contracts/`)

### `cheeseburner.cpp` — `on_cheese_transfer`
- Remove the `reward_amount` calculation (`quantity.amount * 10 / 80`)
- Remove the CHEESE transfer action to `burn_info.caller`
- Change `liquidity_amount` to `quantity.amount * 17 / 80` (21.25% of swapped CHEESE)
- Update `burn_amount` = `quantity.amount - liquidity_amount` (the remainder, ~78.75%)
- Update `update_stats(...)` call — pass `asset(0, CHEESE_SYMBOL)` for the reward argument

### `cheeseburner.hpp`
- No structural changes required; the `stats_row` table can keep `total_cheese_rewards` for historical reference, or it can be removed — your choice. Keeping it avoids a schema migration.

### `cheeseburner.cpp` — `burn()` action
- The `caller` parameter can be kept for logging/identification purposes in `logburn`, even though no reward is paid. This is useful for on-chain transparency (you can see who triggered the burn in transaction history).

## Frontend Changes

### `src/hooks/useWaxData.ts`
- Remove `cheeseRewardAmount` from calculations and return value
- Update `cheeseLiquidityAmount` to `estimatedCheese * (17 / 80)`
- Update `cheeseBurnAmount` to `estimatedCheese * (63 / 80)` (unchanged, but verify)
- Remove `cheeseRewardAmount` from the `WaxData` interface and return object

### `src/components/BurnStats.tsx`
- Remove the "Your Reward" column from the 3-column distribution grid
- Change grid from `grid-cols-3` to `grid-cols-2` (xCHEESE + Compound)
- Update xCHEESE label to reflect the new 17% allocation if desired

### `src/components/BurnButton.tsx`
- Remove the comment `// Pass caller to receive 10% reward`

### `src/pages/Index.tsx`
- Update the hint text from `"Click to claim & burn 🧀🔥"` — the reward mention in comments can be cleaned up

## Technical Notes
- The math check: 78.75% (burn) + 21.25% (xCHEESE) = 100% of swapped CHEESE ✓
- The contract still receives `caller` in the `burn` action — this is kept for `logburn` transparency, not for payment
- No table schema migration is required since `total_cheese_rewards` in the stats table can remain (it will just stop accumulating new values)
- The frontend changes are safe to deploy at any time; they're display-only. The contract changes require redeployment to the `cheeseburner` account on WAX mainnet

## Files Changed

| File | Change |
|---|---|
| `contracts/cheeseburner.cpp` | Remove reward transfer, update liquidity to 17/80 |
| `contracts/cheeseburner.hpp` | Optional: remove `total_cheese_rewards` from stats (or leave it) |
| `src/hooks/useWaxData.ts` | Remove `cheeseRewardAmount`, update liquidity ratio |
| `src/components/BurnStats.tsx` | Remove "Your Reward" card, switch to 2-column grid |
| `src/components/BurnButton.tsx` | Remove reward comment |
