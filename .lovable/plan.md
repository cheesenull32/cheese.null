

# Fix: Update WAX Transfer Source Filter

## Problem

The `on_wax_transfer` handler in `contracts/cheeseburner.cpp` filters incoming WAX transfers by sender account. It currently checks for `eosio.vpay` and `eosio.bpay`, but `claimgbmvote` actually sends WAX from `eosio.voters`. The handler silently exits, leaving the claimed WAX sitting idle in the contract.

## Change

**File: `contracts/cheeseburner.cpp`** -- Update the sender filter in `on_wax_transfer`:

Replace:
```cpp
if (from != "eosio.vpay"_n && from != "eosio.bpay"_n) {
    return;
}
```

With:
```cpp
if (from != "eosio.voters"_n && from != "eosio.vpay"_n && from != "eosio.bpay"_n) {
    return;
}
```

This adds `eosio.voters` as a recognized vote reward source, which is the account that actually dispatches WAX when `claimgbmvote` is called.

## After Updating

1. Copy the updated `.cpp` file to your friend
2. Recompile with `eosio-cpp`
3. Redeploy with `cleos set contract`
4. The stranded WAX from the previous failed burn will need a new `burn` call to process (it won't be picked up automatically since the notification already passed)

