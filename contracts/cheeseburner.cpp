#include "cheeseburner.hpp"
#include <cmath>

// ==================== ACTIONS ====================

ACTION cheeseburner::setconfig(
    name admin,
    uint64_t alcor_pool_id,
    bool enabled,
    asset min_wax_to_burn,
    uint32_t priority_window
) {
    // Get current config to check admin
    config_table config_singleton(get_self(), get_self().value);
    
    if (config_singleton.exists()) {
        // Migration-safe: read only the admin name (first 8 bytes) from raw singleton data.
        // This works whether the stored config has 4 fields (old) or 5 fields (new),
        // because the admin name is always the first field.
        auto db_itr = db_find_i64(get_self().value, get_self().value, "config"_n.value, "config"_n.value);
        if (db_itr >= 0) {
            // Read just enough bytes for a name (8 bytes)
            char buf[8];
            auto bytes_read = db_get_i64(db_itr, buf, sizeof(buf));
            check(bytes_read >= 8, "Corrupted config data");
            name stored_admin = name(*reinterpret_cast<uint64_t*>(buf));
            require_auth(stored_admin);
            // Remove old singleton so it can be re-created with new format
            config_singleton.remove();
        }
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
        .min_wax_to_burn = min_wax_to_burn,
        .priority_window = priority_window
    };
    config_singleton.set(new_config, get_self());
}

ACTION cheeseburner::burn(name caller) {
    // Caller must authorize - they will receive 10% reward
    require_auth(caller);
    
    // Get and validate config
    configrow config = get_config();
    check(config.enabled, "Burns are currently disabled");

    // Check whitelist priority window
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

    // Store caller for later use in on_cheese_transfer
    pending_burn_table pending(get_self(), get_self().value);
    pending.set({
        .caller = caller,
        .timestamp = current_time_point(),
        .wax_claimed = asset(0, WAX_SYMBOL),
        .wax_swapped = asset(0, WAX_SYMBOL)
    }, get_self());

    // Claim vote rewards from eosio
    action(
        permission_level{get_self(), "active"_n},
        EOSIO_CONTRACT,
        "claimgbmvote"_n,
        make_tuple(get_self())
    ).send();
}

// ==================== WHITELIST MANAGEMENT ====================

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

ACTION cheeseburner::rmwhitelist(name account) {
    configrow config = get_config();
    require_auth(config.admin);
    whitelist_table wl(get_self(), get_self().value);
    auto itr = wl.find(account.value);
    check(itr != wl.end(), "Account not whitelisted");
    wl.erase(itr);
}

// ==================== WAX TRANSFER HANDLER ====================

void cheeseburner::on_wax_transfer(name from, name to, asset quantity, string memo) {
    // Ignore outgoing transfers and self-transfers
    if (to != get_self() || from == get_self()) {
        return;
    }

    // Only process WAX from vote reward sources
    if (from != "eosio.voters"_n && from != "eosio.vpay"_n && from != "eosio.bpay"_n) {
        return; // Silently ignore other WAX transfers (e.g., manual deposits)
    }

    check(quantity.symbol == WAX_SYMBOL, "Only WAX tokens expected");
    check(quantity.amount > 0, "Amount must be positive");

    // Verify there's a pending burn
    pending_burn_table pending(get_self(), get_self().value);
    check(pending.exists(), "No pending burn found - call burn() first");

    // Get config for pool ID
    configrow config = get_config();

    // Use the incoming quantity (the claimed vote reward)
    // Calculate 20% for CPU staking, 80% for swap
    int64_t stake_amount = quantity.amount * 20 / 100;
    int64_t swap_amount = quantity.amount - stake_amount;
    
    asset to_stake = asset(stake_amount, WAX_SYMBOL);
    asset to_swap = asset(swap_amount, WAX_SYMBOL);

    // Stake 20% as CPU to self (increases vote weight)
    if (to_stake.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            EOSIO_CONTRACT,
            "delegatebw"_n,
            make_tuple(
                get_self(),                    // from
                get_self(),                    // receiver (stake to self)
                asset(0, WAX_SYMBOL),          // stake_net_quantity (0 NET)
                to_stake,                      // stake_cpu_quantity
                false                          // transfer (keep ownership)
            )
        ).send();
    }

    // Swap remaining 80% for CHEESE via Alcor
    string swap_memo = "swapexactin#" + to_string(config.alcor_pool_id)
        + "#" + get_self().to_string()
        + "#0.0000 CHEESE@cheeseburger"
        + "#0";

    action(
        permission_level{get_self(), "active"_n},
        EOSIO_TOKEN,
        "transfer"_n,
        make_tuple(
            get_self(),             // from
            ALCOR_SWAP_CONTRACT,    // to
            to_swap,                // quantity (80% of WAX)
            swap_memo               // swap instruction
        )
    ).send();

    // Store WAX amounts in pending burn for logburn
    pendingburnr updated_pending = pending.get();
    updated_pending.wax_claimed = quantity;
    updated_pending.wax_swapped = to_swap;
    pending.set(updated_pending, get_self());

    // Update stats with WAX claimed and staked (don't count burn yet)
    update_stats(quantity, to_stake, asset(0, CHEESE_SYMBOL), asset(0, CHEESE_SYMBOL), asset(0, CHEESE_SYMBOL), false);

    // The CHEESE will arrive via on_cheese_transfer notification
    // which will then split: 78.75% nulled, 12.5% reward, 8.75% xCHEESE
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
    pendingburnr burn_info = pending.get();

    // Calculate split for CHEESE portion
    // Since we only swapped 80% of WAX, we need:
    // - Null: 63/80 = 78.75% of CHEESE (63% of original value)
    // - Reward: 10/80 = 12.5% of CHEESE (10% of original value)
    // - xCHEESE: 7/80 = 8.75% of CHEESE (7% of original value)
    int64_t reward_amount = quantity.amount * 10 / 80;    // 12.5%
    int64_t liquidity_amount = quantity.amount * 7 / 80;  // 8.75%
    int64_t burn_amount = quantity.amount - reward_amount - liquidity_amount; // 78.75%
    
    asset reward = asset(reward_amount, CHEESE_SYMBOL);
    asset liquidity = asset(liquidity_amount, CHEESE_SYMBOL);
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

    // Send liquidity portion to xcheeseliqst
    if (liquidity.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(
                get_self(),
                CHEESE_LIQ_ACCOUNT,
                liquidity,
                string("CHEESE liquidity allocation")
            )
        ).send();
    }

    // Burn the rest
    burn_cheese(to_burn);

    // Update statistics (count this as a completed burn)
    update_stats(asset(0, WAX_SYMBOL), asset(0, WAX_SYMBOL), to_burn, reward, liquidity, true);

    // Log burn details to transaction history
    action(
        permission_level{get_self(), "active"_n},
        get_self(),
        "logburn"_n,
        make_tuple(burn_info.caller, burn_info.wax_claimed, burn_info.wax_swapped, to_burn)
    ).send();

    // Update last burn timestamp for priority window tracking
    burn_track_table burn_track(get_self(), get_self().value);
    burn_track.set({ .last_burn = current_time_point() }, get_self());

    // Clear pending burn
    pending.remove();

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

void cheeseburner::update_stats(asset wax_claimed, asset wax_staked, asset cheese_burned, asset cheese_reward, asset cheese_liquidity, bool count_burn) {
    stats_table stats(get_self(), get_self().value);
    
    auto itr = stats.find(0);
    if (itr == stats.end()) {
        stats.emplace(get_self(), [&](auto& row) {
            row.total_burns = count_burn ? 1 : 0;
            row.total_wax_claimed = wax_claimed;
            row.total_wax_staked = wax_staked;
            row.total_cheese_burned = cheese_burned;
            row.total_cheese_rewards = cheese_reward;
            row.total_cheese_liquidity = cheese_liquidity;
        });
    } else {
        stats.modify(itr, same_payer, [&](auto& row) {
            if (count_burn) row.total_burns += 1;
            row.total_wax_claimed += wax_claimed;
            row.total_wax_staked += wax_staked;
            row.total_cheese_burned += cheese_burned;
            row.total_cheese_rewards += cheese_reward;
            row.total_cheese_liquidity += cheese_liquidity;
        });
    }
}

cheeseburner::configrow cheeseburner::get_config() {
    config_table config_singleton(get_self(), get_self().value);
    check(config_singleton.exists(), "Contract not configured. Run setconfig first.");
    return config_singleton.get();
}
