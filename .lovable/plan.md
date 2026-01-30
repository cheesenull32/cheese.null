
# Burn Incentive: 95% Burn / 5% Caller Reward

## Overview
Modify the cheeseburner smart contract to split received CHEESE tokens - 95% burned to `eosio.null` and 5% sent to the account that triggered the burn as a reward incentive.

## Challenge
The current flow has a timing issue:
1. User calls `burn()` action (we know who called it here)
2. Contract claims WAX rewards and swaps for CHEESE
3. CHEESE arrives via `on_cheese_transfer` notification (we don't know who originally called burn)

We need to track the caller from step 1 so it's available in step 3.

## Solution: Store Pending Burn Caller

Add a table to temporarily store who initiated the burn, then read it when CHEESE arrives.

## Contract Changes

### 1. Add New Table (cheeseburner.hpp)

```cpp
// Pending burn caller - stores who initiated the current burn
TABLE pending_burn_row {
    name caller;            // Account that called burn()
    time_point_sec timestamp;  // When burn was initiated
    
    uint64_t primary_key() const { return 0; }
};
typedef singleton<"pendingburn"_n, pending_burn_row> pending_burn_table;
```

### 2. Update Stats Table (cheeseburner.hpp)

Add tracking for rewards paid:

```cpp
TABLE stats_row {
    uint64_t total_burns;
    asset total_wax_claimed;
    asset total_cheese_burned;
    asset total_cheese_rewards;     // NEW: Total CHEESE paid as rewards
    
    uint64_t primary_key() const { return 0; }
};
```

### 3. Modify burn() Action (cheeseburner.cpp)

Capture the caller using `get_first_receiver()` or require the caller to pass themselves:

Option A - Require caller parameter:
```cpp
ACTION cheeseburner::burn(name caller) {
    require_auth(caller);  // Caller must sign
    
    // Store caller for later use in on_cheese_transfer
    pending_burn_table pending(get_self(), get_self().value);
    pending.set({
        .caller = caller,
        .timestamp = current_time_point()
    }, get_self());
    
    // ... rest of burn logic
}
```

### 4. Update on_cheese_transfer Handler (cheeseburner.cpp)

Split the CHEESE 95/5:

```cpp
void cheeseburner::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    if (to != get_self() || from == get_self()) return;
    if (from != ALCOR_SWAP_CONTRACT) {
        check(false, "This contract only accepts CHEESE from Alcor swaps");
    }

    check(quantity.symbol == CHEESE_SYMBOL, "Only CHEESE tokens accepted");
    check(quantity.amount > 0, "Amount must be positive");

    // Get the caller who initiated this burn
    pending_burn_table pending(get_self(), get_self().value);
    check(pending.exists(), "No pending burn found");
    pending_burn_row burn_info = pending.get();
    
    // Calculate split: 95% burn, 5% reward
    int64_t reward_amount = quantity.amount * 5 / 100;  // 5%
    int64_t burn_amount = quantity.amount - reward_amount;  // 95%
    
    asset reward = asset(reward_amount, CHEESE_SYMBOL);
    asset to_burn = asset(burn_amount, CHEESE_SYMBOL);

    // Send 5% reward to caller
    if (reward.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(
                get_self(),
                burn_info.caller,
                reward,
                string("Burn reward - thank you for burning CHEESE!")
            )
        ).send();
    }

    // Burn 95%
    burn_cheese(to_burn);

    // Update statistics
    update_stats(asset(0, WAX_SYMBOL), to_burn, reward);

    // Clear pending burn
    pending.remove();
}
```

### 5. Add Helper for Reward Transfer (cheeseburner.cpp)

```cpp
void cheeseburner::send_reward(name recipient, asset quantity) {
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(
            get_self(),
            recipient,
            quantity,
            string("Burn reward - thank you for burning CHEESE!")
        )
    ).send();
}
```

### 6. Update update_stats Helper

```cpp
void cheeseburner::update_stats(asset wax_claimed, asset cheese_burned, asset cheese_reward) {
    stats_table stats(get_self(), get_self().value);
    
    auto itr = stats.find(0);
    if (itr == stats.end()) {
        stats.emplace(get_self(), [&](auto& row) {
            row.total_burns = 1;
            row.total_wax_claimed = wax_claimed;
            row.total_cheese_burned = cheese_burned;
            row.total_cheese_rewards = cheese_reward;
        });
    } else {
        stats.modify(itr, same_payer, [&](auto& row) {
            row.total_burns += 1;
            row.total_wax_claimed += wax_claimed;
            row.total_cheese_burned += cheese_burned;
            row.total_cheese_rewards += cheese_reward;
        });
    }
}
```

## Frontend Changes

### Update BurnButton.tsx

Pass the caller's account name to the burn action:

```typescript
const burnAction = {
  account: 'cheeseburner',
  name: 'burn',
  authorization: [{ 
    actor: session.actor.toString(),
    permission: 'active' 
  }],
  data: {
    caller: session.actor.toString()  // NEW: Pass caller
  },
};
```

## Transaction Flow

```text
User clicks BURN
       ↓
burn(caller) action
  - require_auth(caller)
  - Store caller in pendingburn table
  - Claim WAX vote rewards
  - Swap WAX → CHEESE via Alcor
       ↓
on_cheese_transfer triggered
  - Read caller from pendingburn table
  - Calculate: 95% burn, 5% reward
  - Send 5% CHEESE to caller
  - Send 95% CHEESE to eosio.null
  - Update stats (burned + rewards)
  - Clear pendingburn table
```

## Example Calculation

If burn produces 10,000 CHEESE:
- 9,500 CHEESE → eosio.null (burned forever)
- 500 CHEESE → caller's wallet (reward)

## Files to Modify

| File | Changes |
|------|---------|
| `contracts/cheeseburner.hpp` | Add `pending_burn_row` table, update `stats_row` |
| `contracts/cheeseburner.cpp` | Update `burn()` to accept caller, split CHEESE in handler |
| `src/components/BurnButton.tsx` | Pass caller to burn action data |

## Security Considerations

- `require_auth(caller)` ensures only the actual caller can claim the reward
- Pending burn has timestamp for potential timeout/cleanup
- Only Alcor swap can trigger the CHEESE handler (existing check)

## Implementation Order

1. Update header file with new table and stats field
2. Update burn() action to require and store caller
3. Update on_cheese_transfer to split CHEESE
4. Update frontend to pass caller parameter
5. Recompile and deploy contract
