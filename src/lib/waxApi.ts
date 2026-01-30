// WAX Blockchain API utilities

const WAX_API_ENDPOINT = 'https://wax.api.eosnation.io/v1/chain/get_table_rows';
const ALCOR_API_ENDPOINT = 'https://wax.alcor.exchange/api/v2/swap/pools';

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

export async function fetchVoterRewards(account: string): Promise<VoterData | null> {
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
    console.error('Error fetching voter rewards:', error);
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

// Calculate claimable WAX from unpaid_voteshare
// The unpaid_voteshare is a complex calculation involving time and vote weight
// For display purposes, we show the raw value divided by precision
export function parseUnpaidVoteshare(voteshare: string): number {
  // unpaid_voteshare is stored as a high precision number
  // We need to convert it to WAX amount
  const value = parseFloat(voteshare);
  if (isNaN(value)) return 0;
  
  // The actual claimable amount depends on global vote pay calculations
  // This is an approximation for display purposes
  return value;
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
