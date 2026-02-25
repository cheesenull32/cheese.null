

# Update Distribution Model + Add Cheesepowerz Tracking

## Summary

Change the WAX and CHEESE distribution splits, remove the caller reward entirely, and add a **new separate table** (`cpowerstats`) in the contract to track WAX sent to the `cheesepowerz` account -- avoiding any modification to the existing `stats` table schema.

## New Distribution Model

### WAX Split (claimed vote rewards)

| Destination | Old | New |
|---|---|---|
| Staked to CPU (delegatebw) | 20% | 20% (unchanged) |
| Sent to `cheesepowerz` | -- | **5%** |
| Swapped for CHEESE via Alcor | 80% | **75%** |

### CHEESE Split (of the swapped CHEESE)

| Destination | Old | New |
|---|---|---|
| Burned to eosio.null | 78.75% of CHEESE | **85%** |
| Sent to xcheeseliqst | 8.75% of CHEESE | **15%** |
| Caller reward | 12.5% of CHEESE | **Removed** |

Math check: 20% + 5% + 75% = 100% WAX. 85% + 15% = 100% CHEESE.

---

## Warnings and Risks

1. **New table, not new row** -- Using a brand-new `multi_index` table (`cpowerstats`) with its own struct avoids any ABI deserialization issues with the existing `stats` table. The existing `stats` table remains untouched in schema.
2. **Existing `total_cheese_rewards` field** -- The `stats_row` already has `total_cheese_rewards`. It will simply stop accumulating. No schema change needed.
3. **Contract redeployment required** -- All contract changes need redeployment to the `cheeseburner` account on WAX mainnet. The frontend changes are display-only and safe to deploy independently.
4. **Alcor swap memo** -- The minimum output in the swap memo changes because we're now swapping 75% instead of 80%. The `0.0000 CHEESE` minimum stays as-is (it's a slippage floor).

---

## Contract Changes

### `cheeseburner.hpp`

Add a new table definition (does NOT touch existing `stats_row`):

```text
TABLE cpowerrow {
    asset total_wax_cheesepowerz;   // Total WAX sent to cheesepowerz
    uint64_t primary_key() const { return 0; }
};
typedef multi_index<"cpowerstats"_n, cpowerrow> cpowerstats_table;
```

Add a new helper declaration:

```text
void update_cpowerstats(asset wax_sent);
```

### `cheeseburner.cpp` -- `on_wax_transfer`

- Change the WAX split from 20/80 to 20/5/75:
  - `stake_amount = quantity.amount * 20 / 100` (unchanged)
  - `cheesepowerz_amount = quantity.amount * 5 / 100` (new)
  - `swap_amount = quantity.amount - stake_amount - cheesepowerz_amount` (75%)
- Add a WAX transfer action to the `cheesepowerz` account with memo `"cheesepowerz allocation"`
- Call `update_cpowerstats(cheesepowerz_wax)` to record it in the new table
- Update the swap memo to use `75` instead of `80` in ratio references

### `cheeseburner.cpp` -- `on_cheese_transfer`

- Remove the `reward_amount` calculation entirely
- Remove the CHEESE transfer action to `burn_info.caller`
- Change CHEESE split to simple 85/15:
  - `liquidity_amount = quantity.amount * 15 / 100`
  - `burn_amount = quantity.amount - liquidity_amount` (85%)
- Update `update_stats(...)` call -- pass `asset(0, CHEESE_SYMBOL)` for the reward argument

### `cheeseburner.cpp` -- new helper

```text
void cheeseburner::update_cpowerstats(asset wax_sent) {
    cpowerstats_table cpower(get_self(), get_self().value);
    auto itr = cpower.find(0);
    if (itr == cpower.end()) {
        cpower.emplace(get_self(), [&](auto& row) {
            row.total_wax_cheesepowerz = wax_sent;
        });
    } else {
        cpower.modify(itr, same_payer, [&](auto& row) {
            row.total_wax_cheesepowerz += wax_sent;
        });
    }
}
```

---

## Frontend Changes

### `src/lib/waxApi.ts`

- Add a new `fetchCheesepowerzStats` function that reads the `cpowerstats` table from the contract
- Add a `CheesepowerzStats` interface

### `src/hooks/useWaxData.ts`

- Remove `cheeseRewardAmount` from the interface and calculations
- Change WAX swap from `0.80` to `0.75`
- Add `waxCheesepowerzAmount = claimableWax * 0.05`
- Change CHEESE split to `estimatedCheese * 0.85` (burn) and `estimatedCheese * 0.15` (liquidity)

### `src/hooks/useContractStats.ts`

- Add a query for the new `cpowerstats` table
- Expose `totalWaxCheesepowerz` in the return value

### `src/components/BurnStats.tsx`

- Remove the "Your Reward" card
- Add a "CheesePowerz" card showing the 5% WAX allocation
- Update grid from `grid-cols-3` to `grid-cols-3` (xCHEESE, Compound, CheesePowerz)

### `src/components/TotalStats.tsx`

- Remove the "Rewards" card from the lifetime stats grid
- Add a "CheesePowerz" card showing `totalWaxCheesepowerz`
- Keep grid at `grid-cols-3` (CheesePowerz, xCHEESE, Compound)

### `src/components/BurnButton.tsx`

- Remove the `// Pass caller to receive 10% reward` comment

---

## Files Changed

| File | Change |
|---|---|
| `contracts/cheeseburner.hpp` | Add `cpowerrow` table + `update_cpowerstats` helper |
| `contracts/cheeseburner.cpp` | WAX split 20/5/75, CHEESE split 85/15, remove reward, add cheesepowerz transfer |
| `src/lib/waxApi.ts` | Add `fetchCheesepowerzStats` + interface |
| `src/hooks/useWaxData.ts` | New ratios, remove reward, add cheesepowerz amount |
| `src/hooks/useContractStats.ts` | Query new `cpowerstats` table |
| `src/components/BurnStats.tsx` | Replace reward card with cheesepowerz card |
| `src/components/TotalStats.tsx` | Replace rewards card with cheesepowerz card |
| `src/components/BurnButton.tsx` | Remove reward comment |

