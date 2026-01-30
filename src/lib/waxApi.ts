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
