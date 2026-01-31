#include "cheeseburner.hpp"
#include <cmath>

// ==================== ACTIONS ====================

ACTION cheeseburner::setconfig(
    name admin,
    uint64_t alcor_pool_id,
    bool enabled,
    asset min_wax_to_burn
) {
    // Get current config to check admin
    config_table config_singleton(get_self(), get_self().value);
    
    if (config_singleton.exists()) {
        configrow current = config_singleton.get();
        require_auth(current.admin);
    } else {
        // First time setup - require contract authority
        require_auth(get_self());
    }

    // Validate inputs
    check(is_account(admin), "Admin account does not exist");
    check(alcor_pool_id > 0, "Invalid Alcor pool ID");
    check(min_wax_to_burn.symbol == WAX_SYMBOL, "min_wax_to_burn must be in WAX");
    check(min_wax_to_burn.amount >= 0, "min_wax_to_burn cannot be negative");

    // Save config
    configrow new_config = {
        .admin = admin,
        .alcor_pool_id = alcor_pool_id,
        .enabled = enabled,
        .min_wax_to_burn = min_wax_to_burn
    };
    config_singleton.set(new_config, get_self());
}

ACTION cheeseburner::burn(name caller) {
    // Caller must authorize - they will receive 5% reward
    require_auth(caller);
    
    // Get and validate config
    configrow config = get_config();
    check(config.enabled, "Burns are currently disabled");

    // Store caller for later use in on_cheese_transfer
    pending_burn_table pending(get_self(), get_self().value);
    pending.set({
        .caller = caller,
        .timestamp = current_time_point()
    }, get_self());

    // Step 1: Claim vote rewards from eosio
    action(
        permission_level{get_self(), "active"_n},
        EOSIO_CONTRACT,
        "claimgbmvote"_n,
        make_tuple(get_self())
    ).send();

    // Get WAX balance (will be updated after claim inline action)
    asset wax_balance = get_wax_balance(get_self());
    
    // Check minimum WAX requirement
    check(wax_balance >= config.min_wax_to_burn, 
        "Insufficient WAX balance. Have: " + wax_balance.to_string() + 
        ", Need: " + config.min_wax_to_burn.to_string());
    check(wax_balance.amount > 0, "No WAX available to swap");

    // Step 2: Calculate 10% for CPU staking, 90% for swap
    int64_t stake_amount = wax_balance.amount * 10 / 100;
    int64_t swap_amount = wax_balance.amount - stake_amount;
    
    asset to_stake = asset(stake_amount, WAX_SYMBOL);
    asset to_swap = asset(swap_amount, WAX_SYMBOL);

    // Step 3: Stake 10% as CPU to self (increases vote weight)
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

    // Step 4: Swap remaining 90% for CHEESE via Alcor
    // Memo format: "swap,<min_output>,<pool_id>"
    string swap_memo = "swap,0," + to_string(config.alcor_pool_id);

    action(
        permission_level{get_self(), "active"_n},
        EOSIO_TOKEN,
        "transfer"_n,
        make_tuple(
            get_self(),             // from
            ALCOR_SWAP_CONTRACT,    // to
            to_swap,                // quantity (90% of WAX)
            swap_memo               // swap instruction
        )
    ).send();

    // The CHEESE will arrive via on_cheese_transfer notification
    // which will then split ~94.4% burn / ~5.6% reward to caller
}

ACTION cheeseburner::logburn(
    name caller,
    asset wax_claimed,
    asset wax_swapped,
    asset cheese_burned
) {
    // Only the contract itself can call this action
    require_auth(get_self());
    
    // Notify the caller so it appears in their tx history
    require_recipient(caller);
    
    // The action data itself IS the log - block explorers show all parameters
}

// ==================== TRANSFER HANDLER ====================

void cheeseburner::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    // Ignore outgoing transfers and self-transfers
    if (to != get_self() || from == get_self()) {
        return;
    }

    // Only process CHEESE from Alcor swap
    if (from != ALCOR_SWAP_CONTRACT) {
        // Reject unexpected CHEESE transfers
        check(false, "This contract only accepts CHEESE from Alcor swaps");
    }

    check(quantity.symbol == CHEESE_SYMBOL, "Only CHEESE tokens accepted");
    check(quantity.amount > 0, "Amount must be positive");

    // Get the caller who initiated this burn
    pending_burn_table pending(get_self(), get_self().value);
    check(pending.exists(), "No pending burn found");
    pending_burn_row burn_info = pending.get();

    // Calculate split for CHEESE portion only
    // Since we only swapped 90% of WAX, we need:
    // - Burn: 85/90 ≈ 94.44% of CHEESE
    // - Reward: 5/90 ≈ 5.56% of CHEESE
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

    // Update statistics (wax_staked is tracked in burn() action)
    update_stats(asset(0, WAX_SYMBOL), asset(0, WAX_SYMBOL), to_burn, reward);

    // Clear pending burn
    pending.remove();
}

// ==================== HELPERS ====================

double cheeseburner::get_wax_cheese_rate(uint64_t pool_id) {
    // Read from swap.alcor pools table
    alcor_pools pools(ALCOR_SWAP_CONTRACT, ALCOR_SWAP_CONTRACT.value);
    auto pool_itr = pools.find(pool_id);
    
    check(pool_itr != pools.end(), "Alcor swap pool not found");
    
    // Determine which token is WAX and which is CHEESE
    double wax_reserve, cheese_reserve;
    uint8_t wax_precision, cheese_precision;
    
    if (pool_itr->tokenA.quantity.symbol.code() == WAX_SYMBOL.code()) {
        wax_reserve = static_cast<double>(pool_itr->tokenA.quantity.amount);
        wax_precision = pool_itr->tokenA.quantity.symbol.precision();
        cheese_reserve = static_cast<double>(pool_itr->tokenB.quantity.amount);
        cheese_precision = pool_itr->tokenB.quantity.symbol.precision();
    } else {
        wax_reserve = static_cast<double>(pool_itr->tokenB.quantity.amount);
        wax_precision = pool_itr->tokenB.quantity.symbol.precision();
        cheese_reserve = static_cast<double>(pool_itr->tokenA.quantity.amount);
        cheese_precision = pool_itr->tokenA.quantity.symbol.precision();
    }
    
    // Use actual precision from pool assets for normalization
    double wax_divisor = pow(10.0, wax_precision);
    double cheese_divisor = pow(10.0, cheese_precision);
    
    wax_reserve /= wax_divisor;
    cheese_reserve /= cheese_divisor;
    
    return cheese_reserve / wax_reserve; // CHEESE per WAX
}

asset cheeseburner::get_wax_balance(name account) {
    token_accounts accounts(EOSIO_TOKEN, account.value);
    auto itr = accounts.find(WAX_SYMBOL.code().raw());
    
    if (itr == accounts.end()) {
        return asset(0, WAX_SYMBOL);
    }
    return itr->balance;
}

asset cheeseburner::get_cheese_balance(name account) {
    token_accounts accounts(CHEESE_CONTRACT, account.value);
    auto itr = accounts.find(CHEESE_SYMBOL.code().raw());
    
    if (itr == accounts.end()) {
        return asset(0, CHEESE_SYMBOL);
    }
    return itr->balance;
}

void cheeseburner::burn_cheese(asset quantity) {
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(
            get_self(),         // from (the contract)
            BURN_ACCOUNT,       // to (eosio.null)
            quantity,           // amount
            string("CHEESE burned via cheeseburner")
        )
    ).send();
}

void cheeseburner::update_stats(asset wax_claimed, asset wax_staked, asset cheese_burned, asset cheese_reward) {
    stats_table stats(get_self(), get_self().value);
    
    auto itr = stats.find(0);
    if (itr == stats.end()) {
        stats.emplace(get_self(), [&](auto& row) {
            row.total_burns = 1;
            row.total_wax_claimed = wax_claimed;
            row.total_wax_staked = wax_staked;
            row.total_cheese_burned = cheese_burned;
            row.total_cheese_rewards = cheese_reward;
        });
    } else {
        stats.modify(itr, same_payer, [&](auto& row) {
            row.total_burns += 1;
            row.total_wax_claimed += wax_claimed;
            row.total_wax_staked += wax_staked;
            row.total_cheese_burned += cheese_burned;
            row.total_cheese_rewards += cheese_reward;
        });
    }
}

cheeseburner::configrow cheeseburner::get_config() {
    config_table config_singleton(get_self(), get_self().value);
    check(config_singleton.exists(), "Contract not configured. Run setconfig first.");
    return config_singleton.get();
}
