

# Update Distribution: Add 5% to xcheeseliqst

## Overview

Change the distribution to include a new recipient:

| Allocation | Current |
|------------|---------|
| WAX Compound (CPU Stake) | 20% |
| CHEESE Nulled | 66% |
| Burner Reward | 5% |
| xCHEESE (xcheeseliqst) | 9% |

## Implementation

### Smart Contract Changes

#### 1. `contracts/cheeseburner.hpp`

Add new constant for xcheeseliqst account:
```cpp
// Liquidity staking account
static constexpr name CHEESE_LIQ_ACCOUNT = "xcheeseliqst"_n;
```

Update stats table to track cheese sent to xcheeseliqst:
```cpp
TABLE stats_row {
    uint64_t total_burns;
    asset total_wax_claimed;
    asset total_wax_staked;
    asset total_cheese_burned;
    asset total_cheese_rewards;
    asset total_cheese_liquidity;  // NEW: Total sent to xcheeseliqst
    
    uint64_t primary_key() const { return 0; }
};
```

Update action documentation and `update_stats` signature:
```cpp
// Main burn action
// Claims vote rewards, stakes 10% to CPU, swaps 90% for CHEESE,
// burns 80% value, rewards 5% to caller, sends 5% to xcheeseliqst
ACTION burn(name caller);

void update_stats(asset wax_claimed, asset wax_staked, asset cheese_burned, 
                  asset cheese_reward, asset cheese_liquidity);
```

#### 2. `contracts/cheeseburner.cpp`

Update `on_cheese_transfer()` to split CHEESE four ways:

```cpp
// Calculate split for CHEESE portion
// Since we only swapped 90% of WAX, we need:
// - Burn: 80/90 ≈ 88.89% of CHEESE (80% of original value)
// - Reward: 5/90 ≈ 5.56% of CHEESE (5% of original value)
// - Liquidity: 5/90 ≈ 5.56% of CHEESE (5% of original value)
int64_t reward_amount = quantity.amount * 5 / 90;     // ~5.56%
int64_t liquidity_amount = quantity.amount * 5 / 90;  // ~5.56%
int64_t burn_amount = quantity.amount - reward_amount - liquidity_amount; // ~88.89%

asset reward = asset(reward_amount, CHEESE_SYMBOL);
asset liquidity = asset(liquidity_amount, CHEESE_SYMBOL);
asset to_burn = asset(burn_amount, CHEESE_SYMBOL);

// Send reward to caller
if (reward.amount > 0) {
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), burn_info.caller, reward,
            string("Burn reward - thank you for burning CHEESE!"))
    ).send();
}

// Send liquidity portion to xcheeseliqst
if (liquidity.amount > 0) {
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), CHEESE_LIQ_ACCOUNT, liquidity,
            string("CHEESE liquidity allocation"))
    ).send();
}

// Burn the rest
burn_cheese(to_burn);

// Update statistics
update_stats(asset(0, WAX_SYMBOL), asset(0, WAX_SYMBOL), to_burn, reward, liquidity);
```

Update `update_stats()` helper with new parameter:
```cpp
void cheeseburner::update_stats(
    asset wax_claimed, 
    asset wax_staked, 
    asset cheese_burned, 
    asset cheese_reward,
    asset cheese_liquidity  // NEW
) {
    // ... add cheese_liquidity tracking to stats table
}
```

### Frontend Changes

#### 3. `src/hooks/useWaxData.ts`

Update interface and calculations:
```typescript
interface WaxData {
  // ... existing fields
  cheeseBurnAmount: number;       // 80% of original value
  cheeseRewardAmount: number;     // 5% of original value
  cheeseLiquidityAmount: number;  // 5% of original value (NEW)
  waxStakeAmount: number;         // 10% of WAX
}

// Updated calculations:
// 10% of WAX goes to CPU stake
const waxStakeAmount = claimableWax * 0.10;

// 90% of WAX is swapped for CHEESE
const waxToSwap = claimableWax * 0.90;
const estimatedCheese = waxToSwap * cheesePerWax;

// Of the swapped CHEESE:
// - 80/90 (~88.89%) is burned
// - 5/90 (~5.56%) is reward
// - 5/90 (~5.56%) is liquidity
const cheeseBurnAmount = estimatedCheese * (80 / 90);
const cheeseRewardAmount = estimatedCheese * (5 / 90);
const cheeseLiquidityAmount = estimatedCheese * (5 / 90);
```

#### 4. `src/components/BurnStats.tsx`

Add liquidity display to the breakdown grid (change from 2 columns to 3 or use 2x2 layout):

```text
Current Estimated $CHEESE Null
1,234,567.8900 CHEESE

Your Reward       Liquidity        Compound Stake
72,621.64         72,621.64        0.95405385
CHEESE            CHEESE           WAX
```

Add Droplet icon from lucide-react for the liquidity section.

## File Changes Summary

| File | Changes |
|------|---------|
| `contracts/cheeseburner.hpp` | Add `CHEESE_LIQ_ACCOUNT` constant, add `total_cheese_liquidity` to stats, update `update_stats` signature |
| `contracts/cheeseburner.cpp` | Update `on_cheese_transfer()` for 80/5/5 split, add transfer to xcheeseliqst, update `update_stats()` |
| `src/hooks/useWaxData.ts` | Add `cheeseLiquidityAmount` calculation (5%) and update burn amount to 80% |
| `src/components/BurnStats.tsx` | Add liquidity display section with Droplet icon |

## New Distribution Math

**From 80% WAX swapped to CHEESE:**
- Nulled: 66/80 = 82.5% of CHEESE received (equals 66% of original WAX value)
- Reward: 5/80 = 6.25% of CHEESE received (equals 5% of original WAX value)
- xCHEESE: 9/80 = 11.25% of CHEESE received (equals 9% of original WAX value)

**Total: 66 + 5 + 9 + 20 = 100% of original value**

