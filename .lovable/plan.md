

# Add Distribution Breakdown to Burn Stats UI

## Overview

Update the BurnStats component to show the complete breakdown of how claimed WAX will be distributed:

| Allocation | Percentage | Display |
|------------|------------|---------|
| CHEESE Burned | 85% | Large main number (existing) |
| Your Reward | 5% | New sub-item |
| Compound (CPU Stake) | 10% | New sub-item (shown as WAX) |

## Visual Design

```text
+------------------------------------------+
|      Claimable Vote Rewards              |
|         9.54053854 WAX                   |
|------------------------------------------|
|        Estimated Cheese Burn             |
|     1,234,567.8900 CHEESE  (85%)         |
|                                          |
|   Your Reward      Compound Stake        |
|   72,621.64 CHEESE    0.95405385 WAX     |
|       (5%)              (10%)            |
|------------------------------------------|
|      Ready to claim! / Next claim in...  |
+------------------------------------------+
```

## Implementation

### 1. Update `useWaxData` Hook

Add calculated values for the distribution breakdown:

```typescript
interface WaxData {
  claimableWax: number;
  estimatedCheese: number;        // Total CHEESE from 90% WAX swap
  cheeseBurnAmount: number;       // 85% of original value (~94.44% of CHEESE)
  cheeseRewardAmount: number;     // 5% of original value (~5.56% of CHEESE)
  waxStakeAmount: number;         // 10% of WAX staked to CPU
  cheesePerWax: number;
  // ... existing fields
}
```

Calculation logic:
```typescript
// 10% of WAX goes to CPU stake
const waxStakeAmount = claimableWax * 0.10;

// 90% of WAX is swapped for CHEESE
const waxToSwap = claimableWax * 0.90;
const totalCheese = waxToSwap * cheesePerWax;

// Of the swapped CHEESE:
// - 85/90 (~94.44%) is burned
// - 5/90 (~5.56%) is reward
const cheeseBurnAmount = totalCheese * (85 / 90);
const cheeseRewardAmount = totalCheese * (5 / 90);
```

### 2. Update `BurnStats` Component

Add the breakdown display below the main Estimated CHEESE section:

```text
Estimated Cheese Burn
1,234,567.8900 CHEESE

[Two-column breakdown]
Your Reward (5%)         Compound Stake (10%)
72,621.64 CHEESE         0.95405385 WAX
```

Use smaller text and icons:
- Gift icon for "Your Reward"
- TrendingUp icon for "Compound Stake"

## File Changes

| File | Changes |
|------|---------|
| `src/hooks/useWaxData.ts` | Add `cheeseBurnAmount`, `cheeseRewardAmount`, `waxStakeAmount` to return values |
| `src/components/BurnStats.tsx` | Add distribution breakdown section with two columns below the main CHEESE amount |

## Technical Notes

- The percentages are calculated from the original WAX value:
  - 10% WAX staked
  - 90% WAX swapped to CHEESE, then split 85/5 (which equals 94.44%/5.56% of the CHEESE amount)
- Display the burn amount as the main large number (85% of original value)
- Show reward and compound in smaller text below
- Keep the existing "Estimated Cheese Burn" header but show the 85% burn amount

