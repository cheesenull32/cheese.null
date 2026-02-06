

# Update Distribution Percentages

## Summary

Change the CHEESE distribution split from 66/5/9 to 63/10/7 across the smart contract and frontend code.

New distribution (of original WAX value):
- 20% WAX staked to CPU (unchanged)
- 80% WAX swapped for CHEESE, then:
  - 63% nulled (was 66%)
  - 10% reward to caller (was 5%)
  - 7% xCHEESE backing (was 9%)

## Files to Update

### 1. Smart Contract: `contracts/cheeseburner.cpp`
- Update the CHEESE split calculation from `5/80`, `9/80` to `10/80`, `7/80`
- Update all comments referencing the old percentages

### 2. Smart Contract: `contracts/cheeseburner.hpp`
- Update comments on the `burn` action from "5% reward", "66% value", "9% to xcheeseliqst" to the new values

### 3. Frontend Hook: `src/hooks/useWaxData.ts`
- Update interface comments from `66%`/`5%`/`9%` to `63%`/`10%`/`7%`
- Update calculation ratios from `(66/80)`, `(5/80)`, `(9/80)` to `(63/80)`, `(10/80)`, `(7/80)`
- Update inline comments

### 4. Frontend Component: `src/components/BurnButton.tsx`
- Update comment from "5% reward" to "10% reward"

## Technical Details

The smart contract math changes from:
```cpp
int64_t reward_amount = quantity.amount * 5 / 80;
int64_t liquidity_amount = quantity.amount * 9 / 80;
int64_t burn_amount = quantity.amount - reward_amount - liquidity_amount;
```
to:
```cpp
int64_t reward_amount = quantity.amount * 10 / 80;
int64_t liquidity_amount = quantity.amount * 7 / 80;
int64_t burn_amount = quantity.amount - reward_amount - liquidity_amount;
```

The `burn_amount` continues to be calculated as the remainder, ensuring no rounding dust is lost.

