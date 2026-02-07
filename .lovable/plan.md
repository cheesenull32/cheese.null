

# Fix: Execution Order -- Claim Before Swap

## Problem

EOSIO inline actions all execute within the same transaction, but the balance is read at the moment `get_wax_balance()` is called -- before `claimgbmvote` has deposited its WAX. The contract swapped whatever WAX was already liquid in the account, then the vote claim arrived afterward, leaving the claimed WAX sitting unused.

## Solution: Two-Action Architecture

Split the `burn` action into two actions that the **frontend sends together in one transaction**:

1. **`burn` action** -- Only claims vote rewards (calls `claimgbmvote`)
2. **`swapnburn` action** -- Reads the (now-updated) balance, stakes 20%, swaps 80%, distributes CHEESE

Since both actions are in the same transaction, the WAX from the claim is available by the time `swapnburn` runs.

## Contract Changes (`contracts/cheeseburner.cpp` and `cheeseburner.hpp`)

### New action in header (`cheeseburner.hpp`):
- Add `ACTION swapnburn(name caller);` declaration

### Refactored `burn` action:
- Remove staking, swapping, and balance logic
- Keep only: auth check, config check, store pending caller, call `claimgbmvote`

### New `swapnburn` action:
- Require contract self-auth (called inline from burn, or by frontend as second action)
- Read WAX balance (now includes claimed rewards)
- Stake 20% to CPU
- Swap 80% via Alcor
- Uses the same correct memo format already in place

### Simplified approach (recommended):
Rather than adding a new action, restructure so the **frontend sends two actions** in one transaction:

1. Action 1: `eosio::claimgbmvote` (caller: `cheeseburner`)
2. Action 2: `cheeseburner::burn` (which now only does the swap/distribute logic)

This way the claim executes first, WAX balance is updated, then `burn` reads the correct balance.

## Frontend Changes (`src/components/BurnButton.tsx`)

Update `handleClick` to send **two actions** in a single transaction:

```
Action 1: {
  account: 'eosio',
  name: 'claimgbmvote',
  authorization: [{ actor: 'cheeseburner', permission: 'active' }],
  data: { owner: 'cheeseburner' }
}

Action 2: {
  account: 'cheeseburner',
  name: 'burn',
  authorization: [{ actor: callerName, permission: 'active' }],
  data: { caller: callerName }
}
```

**Important**: Action 1 requires `cheeseburner@active` authorization. Since `fragglerockk` cannot sign for `cheeseburner`, the contract must still call `claimgbmvote` as an inline action.

### Revised approach -- keep it all in the contract but use two contract actions:

**Contract changes:**

1. Rename current `burn` to just do: auth, config check, store pending caller, call `claimgbmvote`, then call `swapnburn` as a **deferred inline action** -- but deferred actions are deprecated on WAX.

### Final recommended approach -- reorder inline actions:

Actually, the simplest fix: EOSIO inline actions execute in the order they are dispatched. The issue is that `get_wax_balance()` runs in the *parent* action context before any inline actions execute.

**The real fix**: Move the balance check, staking, and swap into the `claimgbmvote` notification handler or use a second action.

**Cleanest solution**: Split into two contract actions sent by the frontend in one transaction:

1. `cheeseburner::claim` -- calls `claimgbmvote` (requires only contract auth, so it must be an inline)
2. `cheeseburner::burn(caller)` -- reads balance, stakes, swaps

But since `claim` needs `cheeseburner@active` and only the contract can authorize that...

### Actual cleanest fix:

Remove `claimgbmvote` from the contract entirely. Have the contract's `burn` action only do the swap/distribute. The **frontend** handles claiming separately -- but the user (`fragglerockk`) cannot call `claimgbmvote` for `cheeseburner`.

### Correct solution:

Keep `claimgbmvote` as inline in `burn`, but **move all balance-dependent logic into `on_notify` handlers**. The WAX from `claimgbmvote` arrives via an `eosio.token::transfer` notification. Add an `on_notify("eosio.token::transfer")` handler that triggers when WAX arrives at the contract.

## Final Design

### Contract changes:

**1. Add WAX transfer notification handler** (`on_wax_transfer`):
- Triggered when WAX arrives (from vote claim or any source)
- Only processes transfers from `eosio.vpay` or `eosio.bpay` (vote reward sources)
- Reads the full WAX balance (now accurate)
- Stakes 20% to CPU
- Swaps 80% via Alcor

**2. Simplify `burn` action**:
- Auth check, config check, store pending caller
- Call `claimgbmvote` inline
- That's it -- the WAX notification handler takes over from there

**3. Header changes** (`cheeseburner.hpp`):
- Add `[[eosio::on_notify("eosio.token::transfer")]] void on_wax_transfer(name from, name to, asset quantity, string memo);`

This is the idiomatic EOSIO pattern: react to token transfers via notifications rather than reading balances inline.

## Summary of File Changes

| File | Change |
|------|--------|
| `contracts/cheeseburner.hpp` | Add `on_wax_transfer` notification handler declaration |
| `contracts/cheeseburner.cpp` | Simplify `burn` to only claim; move staking/swap logic to `on_wax_transfer`; filter by sender (`eosio.vpay`) |

No frontend changes needed -- the single `burn` action from the UI remains the same.

## After updating

Recompile and redeploy the contract to WAX. Also use `setconfig` to reclaim the stranded vote rewards by calling `burn` again (this time the claim will deposit WAX, triggering the new notification handler to swap it).
