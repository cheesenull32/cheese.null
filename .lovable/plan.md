

# Vote Rewards Cooldown & Accruing Display

## Overview
Add 24-hour claim cooldown logic to the CHEESE Burner. The burn button will be disabled when claims are on cooldown, and show a countdown timer. The display will show accruing vote rewards that accumulate over time.

## Current State (from blockchain data)
- Last claim: `2026-01-30T05:52:38.000`
- Current WAX balance: `0.00000000 WAX` (just claimed)
- Staked amount: ~342,426 WAX
- Vote rewards accrue continuously and become claimable after 24 hours

## UI Changes

### Stats Card Updates
```text
+----------------------------------+
|     CLAIMABLE VOTE REWARDS       |
|         0.00000000 WAX           |
|                                  |
|      ESTIMATED CHEESE BURN       |
|            0.0000 CHEESE         |
|                                  |
|   ⏱️ Next claim in: 16h 12m 5s   |
+----------------------------------+
|     [BURN] (disabled/greyed)     |
+----------------------------------+
```

When cooldown expires:
```text
+----------------------------------+
|     CLAIMABLE VOTE REWARDS       |
|       123.45678900 WAX           |
|                                  |
|      ESTIMATED CHEESE BURN       |
|        75,432.1234 CHEESE        |
|                                  |
|        ✅ Ready to claim!        |
+----------------------------------+
|           [BURN] (active)        |
+----------------------------------+
```

## Technical Implementation

### Files to Modify

**1. `src/lib/waxApi.ts`**
- Add `fetchVoterData(account: string)` function to get voter table data
- Returns `last_claim_time`, `staked` amount, and other voter info

**2. `src/hooks/useWaxData.ts`**
- Add new query for voter data (to get `last_claim_time`)
- Calculate `timeUntilNextClaim` (24 hours from last_claim_time)
- Calculate `canClaim` boolean (true if 24 hours passed)
- Return these values to components

**3. `src/components/BurnStats.tsx`**
- Add countdown timer display showing time until next claim
- Use `useEffect` with interval to update countdown every second
- Show "Ready to claim!" when cooldown expires

**4. `src/components/BurnButton.tsx`**
- Accept `disabled` prop based on claim cooldown
- Show disabled styling (greyed out, no glow, no hover effects)
- Update cursor to `not-allowed` when disabled

**5. `src/pages/Index.tsx`**
- Pass claim status from hook to BurnButton

### Cooldown Logic

```typescript
// Calculate time until next claim
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function getTimeUntilNextClaim(lastClaimTime: string): number {
  const lastClaim = new Date(lastClaimTime + 'Z').getTime();
  const nextClaim = lastClaim + CLAIM_COOLDOWN_MS;
  const now = Date.now();
  return Math.max(0, nextClaim - now);
}

function canClaim(lastClaimTime: string): boolean {
  return getTimeUntilNextClaim(lastClaimTime) === 0;
}
```

### Countdown Timer Format

```typescript
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ready!';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  return `${hours}h ${minutes}m ${seconds}s`;
}
```

### Data Flow

```text
Voters Table                    Hook                    UI
     |                           |                      |
     |-- last_claim_time ------->|                      |
     |                           |-- canClaim --------->|
     |                           |-- timeRemaining ---->|
     |                           |                      |
     |                           |     [Timer updates   |
     |                           |      every second]   |
```

## Button States

| State | Appearance | Behavior |
|-------|------------|----------|
| Cooldown Active | Grey background, no glow, "not-allowed" cursor | Click does nothing |
| Ready to Claim | Yellow gradient, pulsing glow, pointer cursor | Click triggers burn |

## Implementation Order

1. Update `waxApi.ts` - add `fetchVoterData` function
2. Update `useWaxData.ts` - add voter query and cooldown calculations
3. Update `BurnStats.tsx` - add countdown timer display
4. Update `BurnButton.tsx` - add disabled state styling
5. Update `Index.tsx` - wire up the disabled state

