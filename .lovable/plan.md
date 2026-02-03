
# Add Lifetime Statistics Component

## Overview

Create a new "TotalStats" component that displays cumulative metrics from the cheeseburner contract's `stats` table. This will be positioned below the NULL button and show lifetime totals for all four distribution categories.

## Data Source

The smart contract already has a `stats` table (defined in `cheeseburner.hpp`) with these fields:

| Field | Description |
|-------|-------------|
| `total_burns` | Total number of null transactions |
| `total_wax_claimed` | Total WAX claimed from voting rewards |
| `total_wax_staked` | Total WAX staked as CPU (compound) |
| `total_cheese_burned` | Total CHEESE nulled |
| `total_cheese_rewards` | Total CHEESE paid as caller rewards |
| `total_cheese_liquidity` | Total CHEESE sent to xcheeseliqst |

## Implementation

### 1. Add API Function (`src/lib/waxApi.ts`)

Create a new function to fetch the stats table from the cheeseburner contract:

```typescript
export interface ContractStats {
  total_burns: number;
  total_wax_claimed: string;   // "123.45678900 WAX"
  total_wax_staked: string;    // "123.45678900 WAX"
  total_cheese_burned: string; // "123.4567 CHEESE"
  total_cheese_rewards: string;
  total_cheese_liquidity: string;
}

export async function fetchContractStats(
  contractAccount: string
): Promise<ContractStats | null>
```

This will query:
- Code: `cheeseburner` (or whatever the deployed contract name is)
- Scope: `cheeseburner`
- Table: `stats`

### 2. Create Hook (`src/hooks/useContractStats.ts`)

A dedicated hook using TanStack Query to:
- Fetch and cache the stats data
- Parse asset strings (e.g., "123.4567 CHEESE") into numbers
- Provide loading/error states
- Auto-refresh periodically (every 30 seconds)

Returns:
```typescript
interface ContractStatsData {
  totalBurns: number;
  totalCheeseNulled: number;
  totalCheeseRewards: number;
  totalCheeseLiquidity: number;
  totalWaxCompounded: number;
  isLoading: boolean;
  isError: boolean;
}
```

### 3. Create Component (`src/components/TotalStats.tsx`)

A new card component with similar styling to BurnStats:

```text
+---------------------------------------+
|      LIFETIME STATISTICS              |
+---------------------------------------+
|                                       |
|   Total CHEESE Nulled                 |
|   0.0000 CHEESE                       |
|                                       |
|   Rewards     xCHEESE     Compound    |
|   0.0000      0.0000      0.00000000  |
|   CHEESE      CHEESE      WAX         |
|                                       |
|   Total Nulls: 0                      |
+---------------------------------------+
```

Features:
- Same visual style as BurnStats (card with cheese glow, backdrop blur)
- Uses same icons (Gift, Droplet, TrendingUp)
- Shows "0" values gracefully when contract isn't live
- Loading skeleton states
- Slightly smaller/subtler than the main stats card

### 4. Update Index Page (`src/pages/Index.tsx`)

Add the TotalStats component below the NULL button:

```tsx
<BurnButton disabled={!canClaim} onBurnSuccess={handleBurnSuccess} />

<p className="text-muted-foreground text-sm">
  {canClaim ? "Click to null 🧀🔥" : "Waiting for cooldown ⏳"}
</p>

<TotalStats />  {/* NEW */}
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/waxApi.ts` | Edit | Add `ContractStats` interface and `fetchContractStats()` function |
| `src/hooks/useContractStats.ts` | Create | New hook for fetching/parsing contract stats |
| `src/components/TotalStats.tsx` | Create | New component to display lifetime totals |
| `src/pages/Index.tsx` | Edit | Import and add TotalStats below NULL button |

## Technical Notes

- The contract account name will be configurable (currently `cheeseburner`)
- Asset parsing handles WAX (8 decimals) and CHEESE (4 decimals) formats
- All values will show as 0 until the contract is deployed and has processed transactions
- The component gracefully handles the case where the stats table doesn't exist yet
