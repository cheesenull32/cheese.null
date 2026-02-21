

# Combined Plan: New Distribution + Whitelist Priority Window

## Summary

Three changes in one update:

1. **New WAX/CHEESE distribution** (15% CPU, 5% cheesepowerz, 80% swap -> 75% burn, 12.5% xCHEESE, 12.5% caller reward)
2. **Whitelist priority window** (48h exclusive window for whitelisted accounts after cooldown)
3. **Whitelist managed via block explorer** using `addwhitelist` and `rmwhitelist` public actions

## New Distribution Model

| Destination | Current | New |
|---|---|---|
| WAX staked to CPU | 20% | **15%** |
| WAX to cheesepowerz | -- | **5%** |
| WAX swapped for CHEESE | 80% | 80% |
| CHEESE burned (eosio.null) | 78.75% of CHEESE | **75% of CHEESE** |
| xCHEESE liquidity | 21.25% of CHEESE | **12.5% of CHEESE** |
| Caller reward | none | **12.5% of CHEESE** |

## Priority Window

```text
Last burn happens
       |
  [0-24h]   --> Cooldown (nobody can burn)
       |
  [24-72h]  --> Whitelist-only window
       |
  [72h+]    --> Open to anyone
```

## Whitelist Management via Block Explorer

The admin can add/remove accounts directly from any WAX block explorer (e.g., waxblock.io) by calling these actions on the `cheeseburner` contract:

- **addwhitelist**: Takes a single `name account` parameter. Requires admin auth. Adds the account to the whitelist table.
- **rmwhitelist**: Takes a single `name account` parameter. Requires admin auth. Removes the account from the whitelist table.

The `whitelist` table is also readable on block explorers so the admin can verify who is currently whitelisted.

---

## Technical Details

### `contracts/cheeseburner.hpp`

- Add constant: `static constexpr name CHEESE_POWER_ACCOUNT = "cheesepowerz"_n;`
- Add whitelist table:
```text
TABLE whitelist_row {
    name account;
    uint64_t primary_key() const { return account.value; }
};
typedef multi_index<"whitelist"_n, whitelist_row> whitelist_table;
```
- Add `priority_window` (uint32_t, default 172800 = 48 hours) to config singleton
- Add `total_wax_cheesepowerz` to `stats_row`
- Declare public actions: `addwhitelist(name account)` and `rmwhitelist(name account)`
- Add private helper: `bool is_whitelisted(name account)`
- Update `update_stats` signature to include cheesepowerz amount
- Update `burn()` comment to reflect new distribution

### `contracts/cheeseburner.cpp`

**`setconfig`** -- Add `priority_window` parameter

**`burn()`** -- Add whitelist priority window check:
- Read last burn timestamp from `burners` table
- If within `cooldown + priority_window`, require caller is whitelisted
- Otherwise allow any caller

**`on_wax_transfer`** -- New WAX split:
- `stake_amount = quantity.amount * 15 / 100` (15% CPU)
- `powerz_amount = quantity.amount * 5 / 100` (5% cheesepowerz)
- `swap_amount = quantity.amount - stake_amount - powerz_amount` (80% swap)
- Add WAX transfer action to `cheesepowerz`

**`on_cheese_transfer`** -- New CHEESE split:
- `reward_amount = quantity.amount * 10 / 80` (12.5% caller reward)
- `liquidity_amount = quantity.amount * 10 / 80` (12.5% xCHEESE)
- `burn_amount = quantity.amount - liquidity_amount - reward_amount` (75%)
- Restore CHEESE transfer to `burn_info.caller`

**New actions (callable from block explorer)**:
- `addwhitelist(name account)` -- requires admin auth, validates account exists, emplaces into whitelist table
- `rmwhitelist(name account)` -- requires admin auth, erases from whitelist table

**`update_stats`** -- Add `wax_cheesepowerz` parameter

### `src/hooks/useWaxData.ts`

- WAX stake: 15% (was 20%)
- Add `waxCheesepowerzAmount = claimableWax * 0.05`
- Add `cheeseRewardAmount = estimatedCheese * (10 / 80)` (12.5%)
- Change `cheeseLiquidityAmount = estimatedCheese * (10 / 80)` (12.5%)
- Change `cheeseBurnAmount = estimatedCheese * (60 / 80)` (75%)

### `src/hooks/useContractStats.ts`

- Add `totalWaxCheesepowerz` field parsing `total_wax_cheesepowerz` from contract

### `src/components/BurnStats.tsx`

- Add "Your Reward" card and "CheesePowerz" card
- Change grid to `grid-cols-2 sm:grid-cols-4`

### `src/components/TotalStats.tsx`

- Add CheesePowerz lifetime stat
- Update grid to `grid-cols-2 sm:grid-cols-4`

### `src/pages/Index.tsx`

- Update hint text to mention reward

---

## Files Changed

| File | Change |
|---|---|
| `contracts/cheeseburner.hpp` | Add cheesepowerz constant, whitelist table, priority_window, cheesepowerz stats, addwhitelist/rmwhitelist declarations |
| `contracts/cheeseburner.cpp` | New WAX 15/5/80 split, restore reward, whitelist check in burn(), addwhitelist/rmwhitelist actions, update setconfig |
| `src/hooks/useWaxData.ts` | Update all ratios, add cheeseRewardAmount and waxCheesepowerzAmount |
| `src/hooks/useContractStats.ts` | Add totalWaxCheesepowerz |
| `src/components/BurnStats.tsx` | Add Reward and CheesePowerz cards, 4-column grid |
| `src/components/TotalStats.tsx` | Add CheesePowerz lifetime stat |
| `src/pages/Index.tsx` | Update hint text |

