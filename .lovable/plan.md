

# CHEESE Burner UI Enhancement

## Overview
Update the UI to display real-time WAX blockchain data: claimable vote rewards and estimated CHEESE purchase amount, with a dark theme featuring cheesy yellow undertones.

## Visual Design Changes

### Color Palette Update
Transform from fire-orange to cheese-yellow theme while keeping the dark background:

| Element | Current | New |
|---------|---------|-----|
| Primary | `hsl(24 100% 50%)` (orange) | `hsl(45 100% 50%)` (golden yellow) |
| Accent | `hsl(12 100% 55%)` (red-orange) | `hsl(48 95% 60%)` (bright cheese) |
| Secondary glow | Red/orange | Warm yellow/gold |
| Background | `hsl(0 0% 4%)` (dark) | Keep dark |
| Button gradient | Orange to red | Yellow to gold |

### Updated Button Styling
- Replace fire gradient with cheese-yellow gradient
- Update glow effects to golden/yellow tones
- Keep the pulsing animation but in yellow hues

## New UI Components

### Stats Display Card
Add a card above the button showing:
```text
+----------------------------------+
|     CLAIMABLE VOTE REWARDS       |
|         123.45678900 WAX         |
|                                  |
|      ESTIMATED CHEESE BURN       |
|        75,432.1234 CHEESE        |
+----------------------------------+
|           [BURN] button          |
+----------------------------------+
```

### Data Flow
```text
Frontend                      WAX Blockchain APIs
   |                                  |
   |----> Fetch voters table -------->|
   |<---- unpaid_voteshare ----------|
   |                                  |
   |----> Fetch Alcor pool 1252 ---->|
   |<---- price data ----------------|
   |                                  |
   | Calculate: WAX * price = CHEESE |
   | Display both values             |
```

## Technical Implementation

### Files to Create/Modify

1. **`src/hooks/useWaxData.ts`** - New custom hook
   - Fetches claimable WAX from eosio voters table
   - Fetches WAX/CHEESE price from Alcor pool 1252 API
   - Returns: `{ claimableWax, estimatedCheese, isLoading, error, refetch }`

2. **`src/lib/waxApi.ts`** - New API utilities
   - `fetchVoterRewards(account: string)` - Query WAX voters table
   - `fetchAlcorPoolPrice(poolId: number)` - Get current price from Alcor

3. **`src/components/BurnButton.tsx`** - Update styling
   - Replace fire colors with cheese yellow colors
   - Add loading states

4. **`src/components/BurnStats.tsx`** - New component
   - Display claimable WAX amount
   - Display estimated CHEESE burn amount
   - Auto-refresh data periodically

5. **`src/pages/Index.tsx`** - Update layout
   - Add BurnStats component above button
   - Update page title/description

6. **`src/index.css`** - Update color variables
   - Replace fire colors with cheese yellow palette
   - Update glow effects to yellow tones

### API Integration Details

**Fetching Claimable Vote Rewards:**
```typescript
// POST to WAX API endpoint
const response = await fetch('https://wax.api.eosnation.io/v1/chain/get_table_rows', {
  method: 'POST',
  body: JSON.stringify({
    code: 'eosio',
    scope: 'eosio', 
    table: 'voters',
    lower_bound: 'cheeseburner',
    upper_bound: 'cheeseburner',
    limit: 1,
    json: true
  })
});
```

**Fetching Alcor Pool 1252 Price:**
```typescript
// GET request to Alcor API
const response = await fetch('https://wax.alcor.exchange/api/v2/swap/pools/1252');
// Returns priceB = 0.609737 (CHEESE per WAX)
```

**Calculation:**
```typescript
const estimatedCheese = claimableWax * alcorPool.priceB;
```

### Data Refresh Strategy
- Initial fetch on component mount
- Auto-refresh every 30 seconds
- Manual refresh button available
- React Query for caching and state management

## Implementation Order

1. Update CSS color variables (cheese yellow theme)
2. Create `src/lib/waxApi.ts` with API functions
3. Create `src/hooks/useWaxData.ts` hook
4. Create `src/components/BurnStats.tsx` component
5. Update `src/components/BurnButton.tsx` styling
6. Update `src/pages/Index.tsx` layout
7. Test data fetching and display

## Technical Notes

- The cheeseburner account must be voting for BPs to earn vote rewards
- Alcor pool 1252 is the WAX/CHEESE trading pair
- Price data from Alcor is in real-time but may have slight variance from actual swap execution
- The `claimgbmvote` action requires the account to have staked WAX and be actively voting

