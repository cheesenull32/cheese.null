
# CHEESE Burner Smart Contract

## Overview
This plan creates a WAX blockchain smart contract called **cheeseburner** that performs three actions when triggered:
1. Claims the contract's vote rewards from the WAX system
2. Swaps the claimed WAX for CHEESE on Alcor Exchange (pool 1252)
3. Burns the CHEESE by sending it to `eosio.null`

## Contract Logic Flow

```text
┌─────────────────────┐
│   User presses      │
│   BURN button       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Call "burn" action │
│  (anyone can call)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Claim vote rewards │
│  from eosio voters  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Check WAX balance  │
│  (must have WAX)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Swap WAX → CHEESE  │
│  via Alcor pool 1252│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Transfer CHEESE to │
│  eosio.null (burn)  │
└─────────────────────┘
```

## Files to Create

### 1. `contracts/cheeseburner.hpp` - Header File
Contains contract definitions including:
- **Constants**: Token contracts, symbols, Alcor swap contract, burn account
- **Tables**:
  - `configrow` - Admin settings (Alcor pool ID, enabled flag)
  - `stats_row` - Track total burns, WAX claimed, CHEESE burned
  - `alcor_pool` - Read Alcor AMM pool data (external table)
  - `token_account` - Read token balances (external table)
- **Actions**:
  - `setconfig` - Admin configuration
  - `burn` - Main action that claims, swaps, and burns
  - `logburn` - Notification action for transaction history

### 2. `contracts/cheeseburner.cpp` - Implementation File
Contains:
- **`setconfig` action** - Set admin and pool configuration
- **`burn` action** - Main logic:
  1. Claim vote rewards via `eosio::claimgbmvote` action
  2. Read contract's WAX balance
  3. Read Alcor pool 1252 to calculate swap rate
  4. Send WAX to Alcor with swap memo
  5. Wait for CHEESE via transfer notification
- **`on_cheese_transfer` handler** - When CHEESE arrives, burn it
- **Helper functions**:
  - `get_wax_cheese_rate()` - Read pool reserves
  - `burn_cheese()` - Send CHEESE to eosio.null
  - `update_stats()` - Track statistics

## Key Technical Details

### Vote Reward Claiming
```cpp
action(
    permission_level{get_self(), "active"_n},
    "eosio"_n,
    "claimgbmvote"_n,
    make_tuple(get_self())
).send();
```

### Alcor Swap (Pool 1252)
The swap is done by sending WAX to `swap.alcor` with a memo specifying the pool and minimum output:
```cpp
// Memo format: "swap,<min_output>,<pool_id>"
string memo = "swap,0,1252";

action(
    permission_level{get_self(), "active"_n},
    "eosio.token"_n,
    "transfer"_n,
    make_tuple(
        get_self(),           // from
        "swap.alcor"_n,       // to
        wax_amount,           // quantity
        memo                  // swap memo
    )
).send();
```

### Burning CHEESE
Same pattern as the cheesepowerz contract:
```cpp
action(
    permission_level{get_self(), "active"_n},
    CHEESE_CONTRACT,
    "transfer"_n,
    make_tuple(
        get_self(),
        "eosio.null"_n,
        quantity,
        string("CHEESE burned")
    )
).send();
```

### Handling the Swap Response
When Alcor sends CHEESE back, we catch it with a notification handler:
```cpp
[[eosio::on_notify("cheeseburger::transfer")]]
void on_cheese_transfer(name from, name to, asset quantity, string memo);
```

## Statistics Tracking
The contract will track:
- Total number of burns
- Total WAX claimed from voting
- Total CHEESE purchased and burned

## Configuration Table
| Field | Type | Description |
|-------|------|-------------|
| admin | name | Contract admin account |
| alcor_pool_id | uint64_t | Alcor pool ID (1252) |
| enabled | bool | Enable/disable burns |
| min_wax_to_burn | asset | Minimum WAX required to proceed |

## Usage After Deployment
1. Deploy contract to `cheeseburner` account
2. Set permissions: `eosio.code` permission for contract
3. Run `setconfig` to configure admin and pool ID
4. Anyone can call `burn` action to trigger the flow

## Next Steps After Contract Creation
- Compile with `eosio-cpp`
- Deploy to WAX testnet for testing
- Update frontend BurnButton to call the contract action
