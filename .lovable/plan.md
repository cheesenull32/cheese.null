
# Modify CHEESE Distribution: Add 10% CPU Staking

## Overview

Change the CHEESE distribution when received from Alcor swap:

| Allocation | Before | After |
|------------|--------|-------|
| Burned | 95% | 85% |
| Caller Reward | 5% | 5% |
| CPU Staking | 0% | 10% (new) |

## Technical Approach

The 10% for CPU staking cannot use CHEESE directly - WAX blockchain requires WAX tokens for staking. There are two possible approaches:

### Option A: Stake WAX Before Swap (Recommended)
Instead of swapping 100% of claimed WAX for CHEESE, stake 10% as CPU first, then swap the remaining 90% for CHEESE.

**Flow:**
1. Claim WAX vote rewards
2. Calculate 10% for CPU staking
3. Call `eosio::delegatebw` to stake 10% as CPU to self
4. Swap remaining 90% WAX for CHEESE via Alcor
5. CHEESE arrives: burn 85/90 (~94.4%) and reward 5/90 (~5.6%)

Wait - this changes the math. Let me recalculate to match your intent:

### Option B: Keep Original Intent (Stake WAX, Split CHEESE)
To achieve the exact split you described:
- 85% CHEESE burned
- 5% CHEESE to caller
- 10% staked as CPU (requires WAX)

**New Flow:**
1. Claim WAX vote rewards (e.g., 10 WAX)
2. Stake 10% of WAX as CPU (1 WAX) → increases vote weight
3. Swap remaining 90% WAX for CHEESE (9 WAX → ~X CHEESE)
4. When CHEESE arrives: burn ~94.4% and reward ~5.6%

OR alternatively, to keep CHEESE percentages exact:
1. Claim WAX vote rewards
2. Swap 100% WAX for CHEESE
3. Sell 10% of CHEESE back to WAX (requires extra swap)
4. Stake that WAX as CPU
5. Burn 85%, reward 5%

The second sub-option is inefficient (double swap fees). I recommend Option A.

## Recommended Implementation (Option A)

**Percentages of original WAX claimed:**
- 10% staked as CPU
- 90% swapped to CHEESE, then:
  - ~94.44% of CHEESE burned (≈85% of original value)
  - ~5.56% of CHEESE to caller (≈5% of original value)

### File Changes

#### 1. `contracts/cheeseburner.hpp`

Add new stats tracking field:
```cpp
TABLE stats_row {
    uint64_t total_burns;
    asset total_wax_claimed;
    asset total_wax_staked;      // NEW: Track WAX staked as CPU
    asset total_cheese_burned;
    asset total_cheese_rewards;
    
    uint64_t primary_key() const { return 0; }
};
```

Update action documentation:
```cpp
// Main burn action - caller receives 5% reward
// Claims vote rewards, stakes 10% to CPU, swaps 90% for CHEESE,
// burns 94.4% CHEESE, rewards 5.6% to caller
ACTION burn(name caller);
```

#### 2. `contracts/cheeseburner.cpp`

Update `burn()` action to stake CPU before swap:

```cpp
ACTION cheeseburner::burn(name caller) {
    require_auth(caller);
    
    configrow config = get_config();
    check(config.enabled, "Burns are currently disabled");

    // Store caller for later
    pending_burn_table pending(get_self(), get_self().value);
    pending.set({
        .caller = caller,
        .timestamp = current_time_point()
    }, get_self());

    // Claim vote rewards
    action(
        permission_level{get_self(), "active"_n},
        EOSIO_CONTRACT,
        "claimgbmvote"_n,
        make_tuple(get_self())
    ).send();

    asset wax_balance = get_wax_balance(get_self());
    
    check(wax_balance >= config.min_wax_to_burn, 
        "Insufficient WAX balance");
    check(wax_balance.amount > 0, "No WAX available");

    // NEW: Calculate 10% for CPU staking
    int64_t stake_amount = wax_balance.amount * 10 / 100;
    int64_t swap_amount = wax_balance.amount - stake_amount;
    
    asset to_stake = asset(stake_amount, WAX_SYMBOL);
    asset to_swap = asset(swap_amount, WAX_SYMBOL);

    // NEW: Stake 10% as CPU to self (increases vote weight)
    if (to_stake.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            EOSIO_CONTRACT,
            "delegatebw"_n,
            make_tuple(
                get_self(),                    // from
                get_self(),                    // receiver (stake to self)
                asset(0, WAX_SYMBOL),          // stake_net_quantity (0 NET)
                to_stake,                      // stake_cpu_quantity (10% WAX)
                false                          // transfer (keep ownership)
            )
        ).send();
    }

    // Swap remaining 90% for CHEESE
    string swap_memo = "swap,0," + to_string(config.alcor_pool_id);
    action(
        permission_level{get_self(), "active"_n},
        EOSIO_TOKEN,
        "transfer"_n,
        make_tuple(
            get_self(),
            ALCOR_SWAP_CONTRACT,
            to_swap,               // Only 90% of WAX
            swap_memo
        )
    ).send();
}
```

Update `on_cheese_transfer()` handler:

```cpp
void cheeseburner::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    if (to != get_self() || from == get_self()) return;
    
    if (from != ALCOR_SWAP_CONTRACT) {
        check(false, "This contract only accepts CHEESE from Alcor swaps");
    }

    check(quantity.symbol == CHEESE_SYMBOL, "Only CHEESE tokens accepted");
    check(quantity.amount > 0, "Amount must be positive");

    pending_burn_table pending(get_self(), get_self().value);
    check(pending.exists(), "No pending burn found");
    pending_burn_row burn_info = pending.get();

    // NEW: Adjusted split for CHEESE portion only
    // Since we only swapped 90% of WAX, we need:
    // - Burn: 85/90 ≈ 94.44% of CHEESE
    // - Reward: 5/90 ≈ 5.56% of CHEESE
    // Simplified: reward = quantity * 5 / 90, burn = quantity - reward
    int64_t reward_amount = quantity.amount * 5 / 90;  // ~5.56%
    int64_t burn_amount = quantity.amount - reward_amount;  // ~94.44%
    
    asset reward = asset(reward_amount, CHEESE_SYMBOL);
    asset to_burn = asset(burn_amount, CHEESE_SYMBOL);

    // Send reward to caller
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

    // Burn the rest
    burn_cheese(to_burn);

    // Update statistics (TODO: add wax_staked tracking)
    update_stats(asset(0, WAX_SYMBOL), to_burn, reward);

    pending.remove();
}
```

#### 3. Update `update_stats()` helper

Add WAX staked tracking:

```cpp
void cheeseburner::update_stats(
    asset wax_claimed, 
    asset wax_staked,      // NEW parameter
    asset cheese_burned, 
    asset cheese_reward
) {
    stats_table stats(get_self(), get_self().value);
    
    auto itr = stats.find(0);
    if (itr == stats.end()) {
        stats.emplace(get_self(), [&](auto& row) {
            row.total_burns = 1;
            row.total_wax_claimed = wax_claimed;
            row.total_wax_staked = wax_staked;     // NEW
            row.total_cheese_burned = cheese_burned;
            row.total_cheese_rewards = cheese_reward;
        });
    } else {
        stats.modify(itr, same_payer, [&](auto& row) {
            row.total_burns += 1;
            row.total_wax_claimed += wax_claimed;
            row.total_wax_staked += wax_staked;    // NEW
            row.total_cheese_burned += cheese_burned;
            row.total_cheese_rewards += cheese_reward;
        });
    }
}
```

## Summary of Changes

| File | Changes |
|------|---------|
| `contracts/cheeseburner.hpp` | Add `total_wax_staked` to stats table, update action docs |
| `contracts/cheeseburner.cpp` | Add CPU staking logic in `burn()`, adjust CHEESE split math in `on_cheese_transfer()`, update `update_stats()` signature |

## Effect on Vote Weight

When WAX is staked via `delegatebw`, it increases the account's staked balance, which in turn increases:
1. CPU resources available to the contract
2. Vote weight for voting rewards (more staked = higher rewards over time)

This creates a compounding effect where each burn slightly increases future voting rewards.
