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

ACTION cheeseburner::burn() {
    // Anyone can call this action - no require_auth needed
    // Get and validate config
    configrow config = get_config();
    check(config.enabled, "Burns are currently disabled");

    // Get WAX balance before claiming
    asset wax_before = get_wax_balance(get_self());

    // Step 1: Claim vote rewards from eosio
    action(
        permission_level{get_self(), "active"_n},
        EOSIO_CONTRACT,
        "claimgbmvote"_n,
        make_tuple(get_self())
    ).send();

    // Note: Due to EOSIO's deferred transaction model, the balance won't update
    // until after this action completes. We use inline actions to handle the flow.
    
    // Get WAX balance after claiming (this gets the balance at tx start, not after claim)
    // The claim happens inline, so we need to read the balance that will exist after claim
    asset wax_balance = get_wax_balance(get_self());
    
    // Check minimum WAX requirement
    check(wax_balance >= config.min_wax_to_burn, 
        "Insufficient WAX balance. Have: " + wax_balance.to_string() + 
        ", Need: " + config.min_wax_to_burn.to_string());
    check(wax_balance.amount > 0, "No WAX available to swap");

    // Step 2: Swap all WAX for CHEESE via Alcor
    // Memo format: "swap,<min_output>,<pool_id>"
    // Using 0 for min_output (no slippage protection) - can be enhanced later
    string swap_memo = "swap,0," + to_string(config.alcor_pool_id);

    action(
        permission_level{get_self(), "active"_n},
        EOSIO_TOKEN,
        "transfer"_n,
        make_tuple(
            get_self(),             // from
            ALCOR_SWAP_CONTRACT,    // to
            wax_balance,            // quantity (all available WAX)
            swap_memo               // swap instruction
        )
    ).send();

    // The CHEESE will arrive via on_cheese_transfer notification
    // which will then burn it and log the transaction
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

    // Burn the received CHEESE
    burn_cheese(quantity);

    // Update statistics
    // Note: wax_claimed is approximated as the same as cheese value for now
    // In a more sophisticated version, we'd track this separately
    update_stats(asset(0, WAX_SYMBOL), quantity);
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

void cheeseburner::update_stats(asset wax_claimed, asset cheese_burned) {
    stats_table stats(get_self(), get_self().value);
    
    auto itr = stats.find(0);
    if (itr == stats.end()) {
        stats.emplace(get_self(), [&](auto& row) {
            row.total_burns = 1;
            row.total_wax_claimed = wax_claimed;
            row.total_cheese_burned = cheese_burned;
        });
    } else {
        stats.modify(itr, same_payer, [&](auto& row) {
            row.total_burns += 1;
            row.total_wax_claimed += wax_claimed;
            row.total_cheese_burned += cheese_burned;
        });
    }
}

cheeseburner::configrow cheeseburner::get_config() {
    config_table config_singleton(get_self(), get_self().value);
    check(config_singleton.exists(), "Contract not configured. Run setconfig first.");
    return config_singleton.get();
}
