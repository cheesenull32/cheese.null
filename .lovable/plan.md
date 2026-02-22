
# Add Whitelist Priority Window to Cheeseburner

## Summary
Add a whitelist system where only approved accounts can call the `burn` action for the first 48 hours after the cooldown expires. After 48 hours, any account can call it. The whitelist is managed via public `addwhitelist` and `rmwhitelist` actions that can be called from any block explorer.

## Contract Changes

### `cheeseburner.hpp`

**New table** -- `whitelist` multi_index storing approved account names:
```text
TABLE whitelist_row {
    name account;
    uint64_t primary_key() const { return account.value; }
};
typedef multi_index<"whitelist"_n, whitelist_row> whitelist_table;
```

**New config field** -- add `uint32_t priority_window` to `configrow` (default 172800 = 48 hours in seconds).

**New actions**:
- `ACTION addwhitelist(name account)` -- admin-only, adds account to whitelist
- `ACTION rmwhitelist(name account)` -- admin-only, removes account from whitelist

**New table** -- `burners` singleton or table to track `last_burn` timestamp (when the last successful burn completed), used to determine if the 48-hour priority window is still active.

```text
TABLE burntrack {
    time_point_sec last_burn;
    uint64_t primary_key() const { return 0; }
};
typedef singleton<"burners"_n, burntrack> burn_track_table;
```

### `cheeseburner.cpp`

**`burn()` action** -- add whitelist check:
```text
// After require_auth(caller) and config check:
burn_track_table burn_track(get_self(), get_self().value);
if (burn_track.exists()) {
    auto track = burn_track.get();
    uint32_t elapsed = current_time_point().sec_since_epoch() - track.last_burn.sec_since_epoch();
    if (elapsed < config.priority_window) {
        // Still in priority window -- caller must be whitelisted
        whitelist_table wl(get_self(), get_self().value);
        auto itr = wl.find(caller.value);
        check(itr != wl.end(), "Priority window active -- only whitelisted accounts can burn right now");
    }
}
```

**`on_cheese_transfer()`** -- update `last_burn` timestamp when a burn completes:
```text
// Before clearing pending burn:
burn_track_table burn_track(get_self(), get_self().value);
burn_track.set({ .last_burn = current_time_point() }, get_self());
```

**`addwhitelist()` action**:
```text
ACTION cheeseburner::addwhitelist(name account) {
    configrow config = get_config();
    require_auth(config.admin);
    check(is_account(account), "Account does not exist");
    whitelist_table wl(get_self(), get_self().value);
    auto itr = wl.find(account.value);
    check(itr == wl.end(), "Account already whitelisted");
    wl.emplace(get_self(), [&](auto& row) {
        row.account = account;
    });
}
```

**`rmwhitelist()` action**:
```text
ACTION cheeseburner::rmwhitelist(name account) {
    configrow config = get_config();
    require_auth(config.admin);
    whitelist_table wl(get_self(), get_self().value);
    auto itr = wl.find(account.value);
    check(itr != wl.end(), "Account not whitelisted");
    wl.erase(itr);
}
```

**`setconfig()`** -- add `priority_window` parameter (default 172800 seconds).

## Frontend Changes

### `src/lib/waxApi.ts`
- Add `fetchWhitelist(contract)` -- reads the `whitelist` table from `cheeseburner`
- Add `fetchBurnTrack(contract)` -- reads the `burners` singleton to get `last_burn` timestamp
- Add `fetchConfig(contract)` -- reads `config` singleton to get `priority_window`

### `src/hooks/useWaxData.ts`
- Add queries for whitelist table, burn track, and config
- Calculate `isPriorityWindow`: true if `now - last_burn < priority_window`
- Calculate `isWhitelisted`: true if connected wallet is in the whitelist table
- Calculate `priorityTimeRemaining`: seconds until priority window ends
- Export: `isPriorityWindow`, `isWhitelisted`, `priorityTimeRemaining`

### `src/components/BurnButton.tsx`
- Import whitelist/priority data from `useWaxData`
- Disable button if `isPriorityWindow && !isWhitelisted`
- Show hint: "Priority window -- whitelisted accounts only (Xh Ym remaining)" when blocked
- Keep existing `isContractUpdating` flag logic

### `src/components/BurnStats.tsx`
- Show priority window status indicator when active (e.g., a small badge or countdown showing when public access opens)

## How It Works

```text
 24hr cooldown ends
       |
       v
 [0-48hrs] Priority Window -- only whitelisted accounts can call burn()
       |
       v
 [48hrs+] Open -- any account can call burn()
       |
       v
 burn() succeeds --> last_burn updated --> new 24hr cooldown starts
       |
       v
 (cycle repeats)
```

## Managing the Whitelist
- **Add**: Call `addwhitelist` action on `cheeseburner` contract via any block explorer (e.g., waxblock.io), passing the account name. Requires admin auth.
- **Remove**: Call `rmwhitelist` action similarly.
- **View**: Read the `whitelist` table on `cheeseburner` via any block explorer to see all whitelisted accounts.

## Files Changed

| File | Change |
|---|---|
| `contracts/cheeseburner.hpp` | Add whitelist table, burntrack singleton, priority_window config field, addwhitelist/rmwhitelist actions |
| `contracts/cheeseburner.cpp` | Implement whitelist check in burn(), update last_burn on completion, implement addwhitelist/rmwhitelist |
| `src/lib/waxApi.ts` | Add fetchWhitelist, fetchBurnTrack, fetchConfig functions |
| `src/hooks/useWaxData.ts` | Add whitelist/priority window queries and calculations |
| `src/components/BurnButton.tsx` | Disable during priority window for non-whitelisted users, show status hint |
| `src/components/BurnStats.tsx` | Show priority window indicator |
