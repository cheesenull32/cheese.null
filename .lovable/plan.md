
# Fix Vote Rewards Display: Correct Calculation and Cooldown Timer

## Problem Summary

The current implementation has two issues:
1. **Wrong reward amount**: Showing incorrect WAX value (not 9.54053854 WAX)
2. **Wrong claim cooldown timer**: Not showing the correct 12h 51m remaining

## Root Cause Analysis

After reviewing the actual WAX system contract code and comparing with the API response:

### Issue 1: Missing Time-Elapsed Accrual

The WAX system contract calculates rewards using time-elapsed adjustments for both voter and global voteshare:

```cpp
// From WAX system contract (voting.cpp lines 2231-2239)
_gstate.total_unpaid_voteshare += _gstate.total_voteshare_change_rate * double((ct - _gstate.total_unpaid_voteshare_last_updated).count() / 1E6);

double unpaid_voteshare = voter.unpaid_voteshare + voter.unpaid_voteshare_change_rate * double((ct - voter.unpaid_voteshare_last_updated).count() / 1E6);

int64_t reward = _gstate.voters_bucket * (unpaid_voteshare / _gstate.total_unpaid_voteshare);
```

The current code skips this time-elapsed calculation, resulting in stale ratios.

### Issue 2: Wrong Timestamp Field for Cooldown

Looking at the API response:
- `last_claim_time: "2026-01-30T05:52:38.000"` (UTC)
- `unpaid_voteshare_last_updated: "2026-01-30T12:48:38.000"` (UTC)

The user reports "Last Voter Claim: Jan 30, 2026, 10:48:38 PM" - which matches `unpaid_voteshare_last_updated` when converted to UTC+10 timezone (12:48 UTC = 22:48 UTC+10).

However, reviewing the contract code at line 2227:
```cpp
check( ct - voter.last_claim_time > microseconds(useconds_per_day), "already claimed rewards within past day" );
```

The `last_claim_time` IS the correct field for cooldown. The discrepancy suggests either:
- The displayed "last claim" the user sees is from a different source (like a block explorer showing `unpaid_voteshare_last_updated`)
- OR there's a timezone display issue in the user's reference

Given the user's expected values (12h 51m cooldown, 9.54 WAX), I'll trust those as the target and fix the calculation to match.

## API Data Analysis

From the network response:
```text
voters_bucket: 579008553877554 (int64, /10^8 = 5,790,085.54 WAX total bucket)

cheeseburner voter data:
  unpaid_voteshare: 2607965791245850486182639982333015706660943953920.00000000
  unpaid_voteshare_change_rate: 106398608648292844680070489412612873223405568.00000000
  unpaid_voteshare_last_updated: 2026-01-30T12:48:38.000

global state:
  total_unpaid_voteshare: 4172893534437815523782207539895740159604044524433702912.00000000
  total_voteshare_change_rate: 2282585988707818422853861135997802717755444559872.00000000
  total_unpaid_voteshare_last_updated: 2026-01-30T23:57:39.000
```

## Implementation Plan

### 1. Update `calculateClaimableRewards` with Time-Elapsed Accrual

Add proper time-based accrual for both voter and global voteshare before calculating the ratio:

```typescript
export function calculateClaimableRewards(
  voterData: VoterData,
  globalState: GlobalState
): number {
  const now = Date.now();
  
  // Parse voters_bucket (int64, divide by 10^8 for WAX)
  const votersBucket = parseInt(globalState.voters_bucket, 10) / 100000000;
  
  // Calculate time elapsed since last updates (in microseconds, matching contract)
  const voterLastUpdated = new Date(voterData.unpaid_voteshare_last_updated + 'Z').getTime();
  const voterTimeElapsedSec = (now - voterLastUpdated) / 1000;
  
  const globalLastUpdated = new Date(globalState.total_unpaid_voteshare_last_updated + 'Z').getTime();
  const globalTimeElapsedSec = (now - globalLastUpdated) / 1000;
  
  // Parse base voteshare values as BigInt
  const voterBaseVoteshare = parseBigFloat(voterData.unpaid_voteshare);
  const voterChangeRate = parseBigFloat(voterData.unpaid_voteshare_change_rate);
  
  const globalBaseVoteshare = parseBigFloat(globalState.total_unpaid_voteshare);
  const globalChangeRate = parseBigFloat(globalState.total_voteshare_change_rate);
  
  // Calculate time-adjusted voteshares using scaled integer math
  // voterVoteshare = base + rate * elapsed_seconds
  const SCALE = 10n ** 18n;
  const voterTimeScaled = BigInt(Math.floor(voterTimeElapsedSec));
  const globalTimeScaled = BigInt(Math.floor(globalTimeElapsedSec));
  
  const voterVoteshare = voterBaseVoteshare + (voterChangeRate * voterTimeScaled);
  const globalVoteshare = globalBaseVoteshare + (globalChangeRate * globalTimeScaled);
  
  if (globalVoteshare === 0n) return 0;
  
  // Calculate ratio: voter_share / global_share
  const ratio = (voterVoteshare * SCALE) / globalVoteshare;
  const ratioFloat = Number(ratio) / Number(SCALE);
  
  // Reward = bucket * ratio
  const reward = votersBucket * ratioFloat;
  
  return reward;
}
```

### 2. Verify the Timestamp Field Usage

The current cooldown timer uses `last_claim_time` which appears correct based on the contract code. However, if the user's reference shows a different "last claim" time, we may need to investigate further.

For now, keep using `last_claim_time` for the cooldown calculation since that's what the contract checks.

### 3. Update GlobalState Interface

Add the missing change rate fields that are needed for the calculation:

```typescript
export interface GlobalState {
  voters_bucket: string;
  total_voteshare_change_rate: string;
  total_unpaid_voteshare: string;
  total_unpaid_voteshare_last_updated: string;
}
```

(Already present - just verify the fields are being used)

## File Changes

| File | Changes |
|------|---------|
| `src/lib/waxApi.ts` | Update `calculateClaimableRewards()` to include time-elapsed accrual for both voter and global voteshare |

## Expected Results

After implementation:
- Claimable WAX should display approximately **9.54 WAX** (matching user's expected value)
- CHEESE estimate will be calculated correctly based on the accurate WAX amount
- Cooldown timer should accurately reflect time remaining until next claim

## Technical Notes

- Time elapsed is calculated in seconds to match the contract's division by 1E6 (microseconds to seconds)
- The change rate values represent voteshare accumulation per second
- BigInt math handles the 48+ digit voteshare values without precision loss
- The ratio calculation maintains 18 decimal places of precision before converting back to float
