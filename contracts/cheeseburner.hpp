#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>

using namespace eosio;
using namespace std;

// CHEESE token contract
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 4);

// WAX system contracts
static constexpr name EOSIO_CONTRACT = "eosio"_n;
static constexpr name EOSIO_TOKEN = "eosio.token"_n;
static constexpr symbol WAX_SYMBOL = symbol("WAX", 8);

// Alcor AMM Swap contract
static constexpr name ALCOR_SWAP_CONTRACT = "swap.alcor"_n;

// Burn account
static constexpr name BURN_ACCOUNT = "eosio.null"_n;

// Default Alcor pool ID for WAX/CHEESE
static constexpr uint64_t DEFAULT_POOL_ID = 1252;

CONTRACT cheeseburner : public contract {
public:
    using contract::contract;

    // ==================== TABLES ====================

    // Configuration singleton
    TABLE configrow {
        name admin;                 // Contract admin account
        uint64_t alcor_pool_id;     // Alcor pool ID for WAX/CHEESE pair (1252)
        bool enabled;               // Whether burns are enabled
        asset min_wax_to_burn;      // Minimum WAX required to proceed with burn
    };
    typedef singleton<"config"_n, configrow> config_table;

    // Statistics table
    // Pending burn caller - stores who initiated the current burn
    TABLE pending_burn_row {
        name caller;               // Account that called burn()
        time_point_sec timestamp;  // When burn was initiated
        
        uint64_t primary_key() const { return 0; }
    };
    typedef singleton<"pendingburn"_n, pending_burn_row> pending_burn_table;

    // Statistics table
    TABLE stats_row {
        uint64_t total_burns;           // Total number of burn transactions
        asset total_wax_claimed;        // Total WAX claimed from voting rewards
        asset total_wax_staked;         // Total WAX staked as CPU
        asset total_cheese_burned;      // Total CHEESE burned
        asset total_cheese_rewards;     // Total CHEESE paid as caller rewards
        
        uint64_t primary_key() const { return 0; }
    };
    typedef multi_index<"stats"_n, stats_row> stats_table;

    // Alcor AMM Swap pools table (external - read only)
    // Matches actual swap.alcor pools table schema
    TABLE alcor_pool {
        uint64_t id;
        bool active;
        extended_asset tokenA;  // First token (e.g., WAX)
        extended_asset tokenB;  // Second token (e.g., CHEESE)
        uint32_t fee;
        uint32_t feeProtocol;
        int32_t tickSpacing;
        uint128_t maxLiquidityPerTick;
        
        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"pools"_n, alcor_pool> alcor_pools;

    // eosio.token accounts table (external - read only)
    TABLE token_account {
        asset balance;
        uint64_t primary_key() const { return balance.symbol.code().raw(); }
    };
    typedef multi_index<"accounts"_n, token_account> token_accounts;

    // ==================== ACTIONS ====================

    // Admin action to configure the contract
    ACTION setconfig(
        name admin,
        uint64_t alcor_pool_id,
        bool enabled,
        asset min_wax_to_burn
    );

    // Main burn action - caller receives 5% reward
    // Claims vote rewards, stakes 10% to CPU, swaps 90% for CHEESE,
    // burns 94.4% CHEESE, rewards 5.6% to caller
    ACTION burn(name caller);

    // Transfer notification handler for CHEESE tokens
    // When CHEESE arrives from Alcor swap, burn it
    [[eosio::on_notify("cheeseburger::transfer")]]
    void on_cheese_transfer(name from, name to, asset quantity, string memo);

    // Notification action - logs burn details to transaction history
    ACTION logburn(
        name caller,
        asset wax_claimed,
        asset wax_swapped,
        asset cheese_burned
    );

private:
    // ==================== HELPERS ====================

    // Get current WAX/CHEESE rate from Alcor AMM swap pool
    double get_wax_cheese_rate(uint64_t pool_id);

    // Get WAX balance of an account
    asset get_wax_balance(name account);

    // Get CHEESE balance of an account
    asset get_cheese_balance(name account);

    // Burn CHEESE tokens by sending to eosio.null
    void burn_cheese(asset quantity);

    // Update statistics
    void update_stats(asset wax_claimed, asset wax_staked, asset cheese_burned, asset cheese_reward);

    // Get or create default config
    configrow get_config();
};
