

# Keep CheesePowerz in Frontend via On-Chain Transfer History

## Overview

Remove `total_wax_cheesepowerz` from the contract's stats table (fixing the ABI mismatch crash), but keep the CheesePowerz stat card in the frontend by querying on-chain transfer history using the WAX Hyperion API.

The Hyperion API indexes all actions on WAX and lets you query transfer history with filters -- so we can sum all WAX transfers from `cheeseburner` to `cheesepowerz` to get the lifetime total.

## Changes

### 1. Contract: Remove `total_wax_cheesepowerz` from stats

**`contracts/cheeseburner.hpp`**
- Remove `total_wax_cheesepowerz` field from `stats_row` struct
- Remove `wax_cheesepowerz` parameter from `update_stats` helper signature

**`contracts/cheeseburner.cpp`**
- Remove `wax_cheesepowerz` from `update_stats` function body and all call sites
- Remove `total_wax_cheesepowerz` from the `migrate` action's emplace block
- The 5% transfer to cheesepowerz stays untouched

### 2. Frontend: Add Hyperion API query

**`src/lib/waxApi.ts`**
- Remove `total_wax_cheesepowerz` from `ContractStats` interface
- Add a new function `fetchCheesepowerzTotal()` that calls the Hyperion API:
  ```
  GET https://wax.eosusa.io/v2/history/get_actions
    ?account=cheeseburner
    &filter=eosio.token:transfer
    &transfer.to=cheesepowerz
    &limit=1000
    &skip=0
  ```
  This returns all transfer actions from cheeseburner to cheesepowerz. The function will sum the WAX amounts from the response to get the lifetime total. It will handle pagination if there are more than 1000 transfers.

### 3. Frontend: New hook for CheesePowerz data

**`src/hooks/useCheesepowerzTotal.ts`** (new file)
- Create a react-query hook that calls `fetchCheesepowerzTotal()`
- Cache aggressively (staleTime: 60s) since historical data changes infrequently
- Returns `{ totalWaxCheesepowerz, isLoading, isError }`

### 4. Frontend: Update existing hook and component

**`src/hooks/useContractStats.ts`**
- Remove `totalWaxCheesepowerz` from this hook (it no longer comes from the stats table)

**`src/components/TotalStats.tsx`**
- Import and use the new `useCheesepowerzTotal` hook
- CheesePowerz card stays in the grid, powered by Hyperion data instead of the stats table
- Show skeleton/fallback independently for this card if Hyperion is slow

## Why This Works

- The contract stats table goes back to its original schema (no `total_wax_cheesepowerz`), fixing the ABI mismatch
- The 5% WAX transfer to cheesepowerz still happens on every burn -- it's just not recorded in the stats table
- The frontend queries Hyperion for the actual transfer history, which is the source of truth anyway
- No data is lost -- Hyperion indexes every transfer permanently

## Files Changed

| File | Change |
|---|---|
| `contracts/cheeseburner.hpp` | Remove `total_wax_cheesepowerz` from struct and `update_stats` signature |
| `contracts/cheeseburner.cpp` | Remove cheesepowerz tracking from `update_stats`, `migrate`, and call sites |
| `src/lib/waxApi.ts` | Remove field from interface, add `fetchCheesepowerzTotal()` Hyperion query |
| `src/hooks/useCheesepowerzTotal.ts` | New hook for Hyperion-based CheesePowerz total |
| `src/hooks/useContractStats.ts` | Remove `totalWaxCheesepowerz` |
| `src/components/TotalStats.tsx` | Use new hook for CheesePowerz card |

