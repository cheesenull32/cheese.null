

# Fix EOSIO Table Name Length Constraint

## Problem
EOSIO table names must be 13 characters or fewer. The current `pendingburn` singleton name and `pending_burn_row` type cause compilation errors.

## Changes

### 1. `contracts/cheeseburner.hpp`
- Rename `pending_burn_row` struct to `pendingburnr` (or similar short name)
- Rename `pending_burn_table` typedef to `pendingburn_t` (the singleton name `"pendingburn"_n` is already fine at 10 chars)
- Update the TABLE name from `pending_burn_row` to `pendingburnr`

### 2. `contracts/cheeseburner.cpp`
- Replace all references to `pending_burn_table` with the new typedef name
- Replace all references to `pending_burn_row` with the new struct name

## Technical Detail

The issue is that EOSIO serializes the TABLE struct name as an EOSIO name, which has the 13-char limit. `pending_burn_row` is 16 characters. Renaming to `pendingburnr` (12 chars) resolves this.

The singleton macro name `"pendingburn"_n` (11 chars) is already compliant -- no change needed there.

