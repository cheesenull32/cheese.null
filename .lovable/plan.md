

# Fix Vote Rewards Calculation: Handle Large Numbers with BigInt

## Problem

The current calculation uses JavaScript's `parseFloat()` on voteshare values that have 48+ significant digits. JavaScript floats only support ~15-17 digits of precision, causing:
- Numbers parsed as `Infinity` or losing precision
- Completely wrong reward calculations
- Currently showing incorrect values in the UI

## Data Analysis

From the actual API responses:
```
voters_bucket: 578966734547186 (int64, needs /10^8 = ~5,789,667 WAX total bucket)

cheeseburner:
  unpaid_voteshare: 2607965791245850486182639982333015706660943953920.00000000
  (48 digits - way beyond float64 precision!)

global:
  total_unpaid_voteshare: 4172409676286281125095931914658329064428566139730132992.00000000
  (55 digits!)
```

Expected result: `~3-4 WAX` (voter_share/total_share * bucket)

## Solution: Use BigInt for Ratio Calculation

Since we only need the ratio of voter_voteshare to total_voteshare, we can:
1. Parse the voteshare strings as BigInt (truncating decimals)
2. Calculate the ratio with scaled integer math
3. Apply the ratio to voters_bucket

## Implementation

### 1. Update `calculateClaimableRewards` in `src/lib/waxApi.ts`

```typescript
export function calculateClaimableRewards(
  voterData: VoterData,
  globalState: GlobalState
): number {
  // Parse voters_bucket (int64, divide by 10^8 for WAX)
  const votersBucket = parseInt(globalState.voters_bucket, 10) / 100000000;
  
  // Parse voteshare values as BigInt (truncate decimal portion)
  // These numbers are too large for JavaScript floats (48-55 digits)
  const voterVoteshare = parseBigFloat(voterData.unpaid_voteshare);
  const totalVoteshare = parseBigFloat(globalState.total_unpaid_voteshare);
  
  if (totalVoteshare === 0n) return 0;
  
  // Calculate ratio using scaled integer math
  // Multiply voter by a large scale, divide by total, then divide by scale
  const SCALE = 10n ** 18n; // 18 decimal places of precision
  const ratio = (voterVoteshare * SCALE) / totalVoteshare;
  
  // Convert ratio back to float and multiply by bucket
  const ratioFloat = Number(ratio) / Number(SCALE);
  const reward = votersBucket * ratioFloat;
  
  return reward;
}

// Helper to parse large decimal strings to BigInt (truncating decimals)
function parseBigFloat(value: string): bigint {
  // Remove decimal portion - we only need integer part for ratio
  const intPart = value.split('.')[0];
  try {
    return BigInt(intPart);
  } catch {
    return 0n;
  }
}
```

### 2. Simplify the Calculation (Skip Time Adjustments Initially)

For the initial fix, skip the time-elapsed adjustments since:
- The voteshare data is already very recent (updated every few seconds)
- The time adjustment adds minimal difference for small time windows
- We can add accurate time adjustments later if needed

The simplified calculation becomes:
```
reward = voters_bucket * (voter_voteshare / total_voteshare)
```

## Why This Works

| Operation | float64 | BigInt |
|-----------|---------|--------|
| Max safe integer | 9 x 10^15 | Unlimited |
| Voteshare digits | 48-55 | Handles all |
| Precision loss | Severe | None for integers |
| Ratio calculation | Wrong | Accurate |

## Expected Result

After this fix:
- Claimable WAX should show `~3-4 WAX` (based on cheeseburner's voteshare proportion)
- CHEESE estimate should be accurate based on pool price
- Values will update correctly on refresh

## File Changes

| File | Changes |
|------|---------|
| `src/lib/waxApi.ts` | Rewrite `calculateClaimableRewards()` to use BigInt for large number handling |

## Technical Notes

- `BigInt` is natively supported in all modern browsers
- We only use BigInt for the ratio calculation, then convert back to Number for the final WAX amount
- The `voters_bucket` itself fits in a standard Number (15 digits)
- Time-elapsed adjustments can be added later for real-time accrual display

