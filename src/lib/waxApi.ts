// WAX Blockchain API utilities

const WAX_API_ENDPOINT = 'https://wax.api.eosnation.io/v1/chain/get_table_rows';
const ALCOR_API_ENDPOINT = 'https://wax.alcor.exchange/api/v2/swap/pools';

export const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface VoterData {
  owner: string;
  proxy: string;
  producers: string[];
  staked: number;
  unpaid_voteshare: string;
  unpaid_voteshare_last_updated: string;
  unpaid_voteshare_change_rate: string;
  last_claim_time: string;
  last_vote_weight: string;
  proxied_vote_weight: string;
  is_proxy: number;
  flags1: number;
  reserved2: number;
  reserved3: string;
}

export interface GlobalState {
  voters_bucket: string;
  total_voteshare_change_rate: string;
  total_unpaid_voteshare: string;
  total_unpaid_voteshare_last_updated: string;
}

export interface AlcorPoolData {
  id: number;
  tokenA: {
    contract: string;
    symbol: string;
    quantity: string;
    decimals: number;
  };
  tokenB: {
    contract: string;
    symbol: string;
    quantity: string;
    decimals: number;
  };
  currSlot: {
    sqrtPriceX64: string;
    tick: number;
    lastObservationTimestamp: number;
    currentObservationNum: number;
    maxObservationNum: number;
  };
  fee: number;
  feeProtocol: number;
  tickSpacing: number;
  maxLiquidityPerTick: string;
  priceA: number;
  priceB: number;
  volumeA24: number;
  volumeB24: number;
  volumeUSD24: number;
  change24: number;
  tvlUSD: number;
}

export interface ContractStats {
  total_burns: number;
  total_wax_claimed: string;
  total_wax_staked: string;
  total_cheese_burned: string;
  total_cheese_rewards: string;
  total_cheese_liquidity: string;
  total_wax_cheesepowerz: string;
}

// Parse asset string like "123.45678900 WAX" to number
export function parseAssetAmount(assetString: string): number {
  if (!assetString) return 0;
  const amount = assetString.split(' ')[0];
  return parseFloat(amount) || 0;
}

export async function fetchContractStats(contractAccount: string): Promise<ContractStats | null> {
  try {
    const response = await fetch(WAX_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: contractAccount,
        scope: contractAccount,
        table: 'stats',
        limit: 1,
        json: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAX API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.rows && data.rows.length > 0) {
      return data.rows[0] as ContractStats;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    return null;
  }
}

export async function fetchWaxBalance(account: string): Promise<number> {
  try {
    const response = await fetch(WAX_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'eosio.token',
        scope: account,
        table: 'accounts',
        limit: 10,
        json: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAX API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.rows && data.rows.length > 0) {
      // Find WAX balance in rows
      const waxRow = data.rows.find((row: { balance: string }) => row.balance.includes('WAX'));
      if (waxRow) {
        // Parse "2.60796579 WAX" -> 2.60796579
        return parseFloat(waxRow.balance.split(' ')[0]);
      }
    }
    
    return 0;
  } catch (error) {
    console.error('Error fetching WAX balance:', error);
    throw error;
  }
}

export async function fetchAlcorPoolPrice(poolId: number): Promise<AlcorPoolData | null> {
  try {
    const response = await fetch(`${ALCOR_API_ENDPOINT}/${poolId}`);

    if (!response.ok) {
      throw new Error(`Alcor API error: ${response.status}`);
    }

    const data = await response.json();
    return data as AlcorPoolData;
  } catch (error) {
    console.error('Error fetching Alcor pool price:', error);
    throw error;
  }
}

// Calculate CHEESE per WAX from pool reserves
export function calculateCheesePerWax(poolData: AlcorPoolData): number {
  // tokenA is CHEESE, tokenB is WAX based on pool 1252
  const cheeseReserve = parseFloat(poolData.tokenA.quantity.toString());
  const waxReserve = parseFloat(poolData.tokenB.quantity.toString());
  
  if (waxReserve === 0) return 0;
  
  // CHEESE you get per 1 WAX
  return cheeseReserve / waxReserve;
}

// Format WAX amount with proper precision
export function formatWaxAmount(amount: number): string {
  return amount.toFixed(8);
}

// Format CHEESE amount with proper precision
export function formatCheeseAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

// Fetch voter info from eosio voters table
export async function fetchVoterInfo(account: string): Promise<VoterData | null> {
  try {
    const response = await fetch(WAX_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'eosio',
        scope: 'eosio',
        table: 'voters',
        lower_bound: account,
        upper_bound: account,
        limit: 1,
        json: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAX API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.rows && data.rows.length > 0) {
      return data.rows[0] as VoterData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching voter info:', error);
    throw error;
  }
}

// Calculate time until next claim (in milliseconds)
export function getTimeUntilNextClaim(lastClaimTime: string): number {
  const lastClaim = new Date(lastClaimTime + 'Z').getTime();
  const nextClaim = lastClaim + CLAIM_COOLDOWN_MS;
  const now = Date.now();
  return Math.max(0, nextClaim - now);
}

// Check if claim is available
export function canClaim(lastClaimTime: string): boolean {
  return getTimeUntilNextClaim(lastClaimTime) === 0;
}

// Format countdown for display
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ready!';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  return `${hours}h ${minutes}m ${seconds}s`;
}

// Fetch global state from eosio global table
export async function fetchGlobalState(): Promise<GlobalState | null> {
  try {
    const response = await fetch(WAX_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'eosio',
        scope: 'eosio',
        table: 'global',
        limit: 1,
        json: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAX API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.rows && data.rows.length > 0) {
      return data.rows[0] as GlobalState;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching global state:', error);
    throw error;
  }
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

// Calculate claimable vote rewards from voter and global state
// Uses BigInt for voteshare values (48-55 digits) that exceed float64 precision
// Includes time-elapsed accrual matching WAX system contract logic
export function calculateClaimableRewards(
  voterData: VoterData,
  globalState: GlobalState
): number {
  const now = Date.now();
  
  // Parse voters_bucket (int64, divide by 10^8 for WAX)
  const votersBucket = parseInt(globalState.voters_bucket, 10) / 100000000;
  
  // Calculate time elapsed since last updates (in seconds)
  const voterLastUpdated = new Date(voterData.unpaid_voteshare_last_updated + 'Z').getTime();
  const voterTimeElapsedSec = Math.max(0, (now - voterLastUpdated) / 1000);
  
  const globalLastUpdated = new Date(globalState.total_unpaid_voteshare_last_updated + 'Z').getTime();
  const globalTimeElapsedSec = Math.max(0, (now - globalLastUpdated) / 1000);
  
  // Parse base voteshare values as BigInt
  const voterBaseVoteshare = parseBigFloat(voterData.unpaid_voteshare);
  const voterChangeRate = parseBigFloat(voterData.unpaid_voteshare_change_rate);
  
  const globalBaseVoteshare = parseBigFloat(globalState.total_unpaid_voteshare);
  const globalChangeRate = parseBigFloat(globalState.total_voteshare_change_rate);
  
  // Calculate time-adjusted voteshares using scaled integer math
  // voteshare = base + rate * elapsed_seconds (matching contract logic)
  const voterTimeScaled = BigInt(Math.floor(voterTimeElapsedSec));
  const globalTimeScaled = BigInt(Math.floor(globalTimeElapsedSec));
  
  const voterVoteshare = voterBaseVoteshare + (voterChangeRate * voterTimeScaled);
  const globalVoteshare = globalBaseVoteshare + (globalChangeRate * globalTimeScaled);
  
  if (globalVoteshare === 0n) return 0;
  
  // Calculate ratio using scaled integer math
  // Multiply voter by a large scale, divide by total, then divide by scale
  const SCALE = 10n ** 18n; // 18 decimal places of precision
  const ratio = (voterVoteshare * SCALE) / globalVoteshare;
  
  // Convert ratio back to float and multiply by bucket
  const ratioFloat = Number(ratio) / Number(SCALE);
  const reward = votersBucket * ratioFloat;
  
  return reward;
}
