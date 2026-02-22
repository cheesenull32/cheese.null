

# Fix setconfig Deserialization Crash

## Root Cause

The `config_singleton.exists()` call on line 16 may internally deserialize the row in certain CDT versions (the underlying `multi_index::find` can populate its cache). Even though `get()` is bypassed when `has_auth(get_self())`, the `exists()` check itself triggers the "datastream read past the end" error because the on-chain config data was written with a shorter/older struct (before `priority_window` was added).

## Fix

Restructure `setconfig` to check `has_auth(get_self())` FIRST, before touching the singleton at all. If the contract account is calling, skip straight to validation and writing -- no need to read the old config.

### `contracts/cheeseburner.cpp` -- lines 12-27

Replace the current auth block with:

```cpp
) {
    config_table config_singleton(get_self(), get_self().value);

    if (!has_auth(get_self())) {
        // Non-owner caller: must read config to verify admin
        check(config_singleton.exists(), "Contract not configured. Run setconfig first.");
        configrow current = config_singleton.get();
        require_auth(current.admin);
    }
    // If has_auth(get_self()), skip all reads -- contract owner can always update

    // Validate inputs
    ...
```

This way, when you call `setconfig` as `cheeseburner`, the code never calls `exists()` or `get()` on the singleton -- it jumps straight to validation and `set()`, which overwrites the old data with the correct 5-field struct. After this one call succeeds, future admin calls will also work because the on-chain data will match the current struct.

## Only File Changed

| File | Change |
|---|---|
| `contracts/cheeseburner.cpp` | Restructure auth check in `setconfig` to avoid reading config singleton when contract owner calls |

