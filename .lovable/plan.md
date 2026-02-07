

# Fix: Cheeseburner Contract Errors

## Problem 1: Wrong Alcor Swap Memo Format (causes the name error)

The contract builds the swap memo as `"swap,0,1252"` (line 96 of `cheeseburner.cpp`), but the Alcor AMM swap contract expects a completely different format:

```
swapexactin#<Pool ID>#<Recipient>#<Output Token>#<Deadline>
```

When Alcor receives the malformed memo, it tries to parse parts of it as EOSIO names and fails because characters like `0` are not valid in EOSIO names (only `a-z`, `1-5`, `.` are allowed).

### Fix

In `contracts/cheeseburner.cpp`, replace line 96:

```cpp
// OLD (wrong format):
string swap_memo = "swap,0," + to_string(config.alcor_pool_id);

// NEW (correct Alcor AMM format):
string swap_memo = "swapexactin#" + to_string(config.alcor_pool_id)
    + "#" + get_self().to_string()
    + "#0.0000 CHEESE@cheeseburger"
    + "#0";
```

Parameters explained:
- `swapexactin` -- swap type (swap all input for maximum output)
- Pool ID -- `1252`
- Recipient -- `cheeseburner` (the contract itself, to receive CHEESE for distribution)
- Output Token -- `0.0000 CHEESE@cheeseburger` (minimum output amount, 0 = no slippage protection)
- Deadline -- `0` (no deadline)

## Problem 2: Stale Balance Check (secondary bug)

On line 63, `get_wax_balance(get_self())` is called immediately after dispatching the `claimgbmvote` inline action. However, inline actions execute **after** the current action completes, so this reads the **pre-claim** balance.

### Fix

This means the contract will only work if there is already enough WAX in the contract balance from a **previous** claim. For a first-time run or if the balance is below `min_wax_to_burn`, it will fail with "Insufficient WAX balance."

Two options to fix this:
1. **Simple approach**: Split into two transactions -- one to claim rewards, another to swap. This is the most reliable.
2. **Keep single transaction**: Remove the balance check and trust that the claim will provide enough WAX (risky if the claim amount is small).

Recommended: keep the current single-transaction flow but understand that the balance check uses the **existing** contract balance (not including the just-claimed rewards). The claimed WAX from `claimgbmvote` will still be available for the `transfer` inline action since they all execute in the same transaction. So the swap will work -- the balance **check** is just inaccurate. To fix this properly, move the `check` after the claim by restructuring to use a two-action flow, or simply lower `min_wax_to_burn` to `0.00000000 WAX` to avoid the check blocking the transaction.

## Summary of Changes

Only `contracts/cheeseburner.cpp` needs updating:
1. **Line 96**: Fix the Alcor swap memo format from comma-separated to the correct `#`-separated format with proper parameters
2. **Optional**: Adjust or remove the `min_wax_to_burn` check, or set it to 0 via `setconfig`

After updating the contract code, you will need to **recompile and redeploy** the contract to WAX.

