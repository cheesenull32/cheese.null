

# Fix Data Fetching: Show Actual Unclaimed Vote Rewards

## Overview

Currently the app displays the `cheeseburner` account's WAX **balance** (which is 0.00000000 WAX) instead of its **unclaimed vote rewards**. This plan adds proper calculation of pending vote rewards using data from the WAX blockchain's `eosio::global` and `eosio::voters` tables.

## Current Problem

The app fetches WAX balance from `eosio.token::accounts` table:
- Returns: `0.00000000 WAX` (the current liquid balance)
- This is wrong because rewards are **unclaimed** - they're not in the balance yet

## Solution: Calculate Pending Rewards from Blockchain State

WAX vote rewards are calculated using this formula from the system contract:

```text
voter_voteshare = unpaid_voteshare + unpaid_voteshare_change_rate * time_elapsed
global_voteshare = total_unpaid_voteshare + total_voteshare_change_rate * time_elapsed  
claimable_wax = voters_bucket * (voter_voteshare / global_voteshare)
```

## Data Sources Required

| Table | Contract | Scope | Fields Needed |
|-------|----------|-------|---------------|
| `global` | eosio | eosio | `voters_bucket`, `total_unpaid_voteshare`, `total_voteshare_change_rate`, `total_unpaid_voteshare_last_updated` |
| `voters` | eosio | eosio | `unpaid_voteshare`, `unpaid_voteshare_change_rate`, `unpaid_voteshare_last_updated` (already fetched) |

## Implementation Plan

### 1. Add Global State Fetching (`src/lib/waxApi.ts`)

Add new interface and fetch function:

```typescript
export interface GlobalState {
  voters_bucket: number;
  total_voteshare_change_rate: string;
  total_unpaid_voteshare: string;
  total_unpaid_voteshare_last_updated: string;
}

export async function fetchGlobalState(): Promise<GlobalState | null> {
  // POST to get_table_rows
  // code: 'eosio', scope: 'eosio', table: 'global', limit: 1
}
```

### 2. Add Reward Calculation Function (`src/lib/waxApi.ts`)

```typescript
export function calculateClaimableRewards(
  voterData: VoterData,
  globalState: GlobalState
): number {
  const now = Date.now();
  
  // Parse voter's voteshare data
  const voterLastUpdated = new Date(voterData.unpaid_voteshare_last_updated + 'Z').getTime();
  const voterTimeElapsed = (now - voterLastUpdated) / 1000; // seconds
  const voterVoteshare = parseFloat(voterData.unpaid_voteshare) + 
    parseFloat(voterData.unpaid_voteshare_change_rate) * voterTimeElapsed;
  
  // Parse global voteshare data  
  const globalLastUpdated = new Date(globalState.total_unpaid_voteshare_last_updated + 'Z').getTime();
  const globalTimeElapsed = (now - globalLastUpdated) / 1000;
  const globalVoteshare = parseFloat(globalState.total_unpaid_voteshare) + 
    parseFloat(globalState.total_voteshare_change_rate) * globalTimeElapsed;
  
  if (globalVoteshare === 0) return 0;
  
  // Calculate reward: voters_bucket * (voter_share / total_share)
  const votersBucket = globalState.voters_bucket;
  const reward = votersBucket * (voterVoteshare / globalVoteshare);
  
  // Convert from internal units (10^8 precision) to WAX
  return reward / 100000000;
}
```

### 3. Update Hook to Fetch Global State (`src/hooks/useWaxData.ts`)

Add a new query for global state and use the calculation:

```typescript
// Add global state query
const globalQuery = useQuery({
  queryKey: ['globalState'],
  queryFn: () => fetchGlobalState(),
  refetchInterval: REFRESH_INTERVAL,
  staleTime: 10000,
});

// Calculate claimable rewards instead of using balance
const claimableWax = useMemo(() => {
  if (!voterQuery.data || !globalQuery.data) return 0;
  return calculateClaimableRewards(voterQuery.data, globalQuery.data);
}, [voterQuery.data, globalQuery.data]);
```

### 4. Remove Balance Query

The `fetchWaxBalance` query becomes unnecessary since we're calculating rewards, not reading balance.

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/waxApi.ts` | Add `GlobalState` interface, `fetchGlobalState()` function, and `calculateClaimableRewards()` function |
| `src/hooks/useWaxData.ts` | Add global state query, replace balance with calculated rewards |

## Expected Result

After implementation:
- The UI will show the actual **claimable vote rewards** (e.g., `~2.61 WAX` based on the `unpaid_voteshare` data)
- This value will update in real-time as rewards accrue
- The estimated CHEESE burn will reflect the actual claimable amount

## Technical Notes

- Vote rewards are stored as very large numbers in scientific notation (e.g., `2607965791245850486182639982333015706660943953920.00000000`)
- The `voters_bucket` is stored as an int64 in base units (10^8 precision for WAX's 8 decimal places)
- Time calculations use microseconds in the contract but we'll work with milliseconds/seconds in JS

