

# Fix: Config Singleton Migration in setconfig

## Problem

The `setconfig` action reads the existing config to verify the admin. But the on-chain config was written with the old struct (no `priority_window` field), so deserialization fails before the new config can be saved. This creates a deadlock -- you can't update config because reading the old config crashes.

## Solution

Modify `setconfig` to catch the migration case: instead of calling `config_singleton.get()` directly, read the raw data size. If it doesn't match the expected new struct size, fall back to `require_auth(get_self())` (contract owner auth) to allow rewriting the singleton.

## Technical Details

### `contracts/cheeseburner.cpp` -- `setconfig` action

Replace the config-reading block with a safe migration approach:

```cpp
config_table config_singleton(get_self(), get_self().value);

if (config_singleton.exists()) {
    // Try to read raw data to check if it's the old format
    auto raw = config_singleton.get_or_default(configrow{
        .admin = get_self(),
        .alcor_pool_id = DEFAULT_POOL_ID,
        .enabled = false,
        .min_wax_to_burn = asset(0, WAX_SYMBOL),
        .priority_window = 172800
    });
    // If deserialization fails with get(), fall back to contract owner auth
    // We use get_self() auth as a safe fallback for migration
    if (!has_auth(raw.admin)) {
        require_auth(get_self());
    }
} else {
    require_auth(get_self());
}
```

However, `get_or_default` will still fail on partial reads. The cleanest approach is to simply check both auths:

```cpp
if (config_singleton.exists()) {
    // During migration from old struct, get() may fail.
    // Allow contract owner to bypass admin check.
    if (has_auth(get_self())) {
        // Contract owner can always update config
    } else {
        configrow current = config_singleton.get();
        require_auth(current.admin);
    }
} else {
    require_auth(get_self());
}
```

This way:
- If called with `get_self()` (contract owner) auth, it skips reading the old config entirely
- If called with admin auth, it reads config normally (works after migration)
- The user calls `setconfig` once using the **contract owner account** to migrate, then admin works going forward

## Steps for the User

1. We update the contract code
2. You recompile and redeploy the contract
3. Call `setconfig` using the **contract owner account** (not the admin account) -- this bypasses the broken config read
4. After that, the admin account works normally for future `setconfig` calls

## Files Changed

| File | Change |
|---|---|
| `contracts/cheeseburner.cpp` | Update `setconfig` to allow contract owner auth to bypass config read during migration |

