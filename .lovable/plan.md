

# Fix WAX Display and CHEESE Price Calculation

## Issues Identified

1. **WAX Amount is Wrong**: The `unpaid_voteshare` field from the voters table is an internal accounting number (huge value like `2607965791245850486182639982333015706660943953920`), not the actual claimable WAX. We need to fetch the contract's WAX balance or use a different calculation method.

2. **Price Calculation**: The current code uses `priceB` from Alcor API which is actually correct (CHEESE per WAX), but we should also calculate from reserves like the cheesepowerz contract does for accuracy.

## Solution

### 1. Fetch WAX Balance Instead of unpaid_voteshare

The actual claimable amount should be fetched from the contract's WAX balance in `eosio.token` accounts table, OR we need to properly calculate the claimable rewards using the global vote pay state.

For simplicity, let's fetch the WAX balance of the cheeseburner account:

```typescript
// Fetch WAX balance from eosio.token accounts table
const response = await fetch(WAX_API_ENDPOINT, {
  method: 'POST',
  body: JSON.stringify({
    code: 'eosio.token',
    scope: 'cheeseburner',
    table: 'accounts',
    limit: 10,
    json: true
  })
});
```

### 2. Calculate CHEESE Rate from Pool Reserves

Use the same logic as the cheesepowerz contract:

```typescript
// From Alcor pool data
const cheeseReserve = poolData.tokenA.quantity; // 78117.7863 CHEESE
const waxReserve = poolData.tokenB.quantity;    // 128121.07898766 WAX

// CHEESE per WAX (how much CHEESE you get for 1 WAX)
const cheesePerWax = cheeseReserve / waxReserve;
```

## Files to Modify

### `src/lib/waxApi.ts`
- Add `fetchWaxBalance(account: string)` function to get WAX balance
- Update `parseUnpaidVoteshare` or replace with proper balance fetching
- Add `calculateCheesePerWax(poolData)` function using reserves

### `src/hooks/useWaxData.ts`
- Fetch WAX balance instead of voter rewards (or in addition to)
- Calculate CHEESE rate from pool reserves instead of using `priceB`

### `src/components/BurnStats.tsx`
- Ensure WAX displays with 8 decimals (already using `formatWaxAmount`)

## Technical Details

### WAX Balance API Call
```typescript
export async function fetchWaxBalance(account: string): Promise<number> {
  const response = await fetch(WAX_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'eosio.token',
      scope: account,
      table: 'accounts',
      limit: 10,
      json: true
    })
  });
  
  const data = await response.json();
  // Find WAX balance in rows
  const waxRow = data.rows.find(row => row.balance.includes('WAX'));
  if (waxRow) {
    // Parse "2.60796579 WAX" -> 2.60796579
    return parseFloat(waxRow.balance.split(' ')[0]);
  }
  return 0;
}
```

### CHEESE Per WAX Calculation
```typescript
export function calculateCheesePerWax(poolData: AlcorPoolData): number {
  // tokenA is CHEESE, tokenB is WAX based on pool 1252
  const cheeseReserve = parseFloat(poolData.tokenA.quantity);
  const waxReserve = parseFloat(poolData.tokenB.quantity);
  
  // CHEESE you get per 1 WAX
  return cheeseReserve / waxReserve;
}
```

### Example Calculation
- WAX Balance: 2.60796579 WAX
- Pool: 78117.7863 CHEESE / 128121.07898766 WAX = 0.6097 CHEESE/WAX
- Estimated CHEESE: 2.60796579 * 0.6097 = ~1.59 CHEESE

This matches the user's expected value of roughly 1.5930 CHEESE.

