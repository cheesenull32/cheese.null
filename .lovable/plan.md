

# Fix Double-Counting Stats and Wire Up logburn Action

## Overview
Two targeted fixes to the `cheeseburner` smart contract:
1. **Fix double-counting stats** -- `total_burns` increments twice per burn cycle (once in each transfer handler)
2. **Wire up the logburn action** -- it exists but is never called

## Changes

### File: `contracts/cheeseburner.hpp`

**Update `pendingburnr` struct** to store WAX amounts for use by `logburn`:
- Add `asset wax_claimed` -- total WAX received from vote rewards
- Add `asset wax_swapped` -- the 80% portion sent to Alcor

**Update `update_stats` signature** to add a `bool count_burn` parameter so callers can control whether `total_burns` is incremented.

### File: `contracts/cheeseburner.cpp`

**Fix 1 -- Stats double-counting:**
- Change `on_wax_transfer` call to `update_stats(..., false)` -- do NOT increment `total_burns` here
- Change `on_cheese_transfer` call to `update_stats(..., true)` -- only increment when the burn actually completes
- Update `update_stats` definition to conditionally increment `total_burns` based on the new parameter

**Fix 2 -- Wire up logburn:**
- In `on_wax_transfer`: store `wax_claimed` (full quantity) and `wax_swapped` (the 80% portion) in the `pendingburnr` singleton
- In `on_cheese_transfer`: before `pending.remove()`, fire an inline `logburn` action:
```text
action(
    permission_level{get_self(), "active"_n},
    get_self(),
    "logburn"_n,
    make_tuple(burn_info.caller, burn_info.wax_claimed, burn_info.wax_swapped, to_burn)
).send();
```

## Summary of Touched Code

| File | What changes |
|------|-------------|
| `contracts/cheeseburner.hpp` | Add 2 fields to `pendingburnr`, update `update_stats` signature |
| `contracts/cheeseburner.cpp` | Update `update_stats` definition, fix both call sites, store WAX in pending, add `logburn` inline action |

