import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { 
  fetchAlcorPoolPrice, 
  fetchVoterInfo,
  fetchGlobalState,
  calculateCheesePerWax,
  calculateClaimableRewards,
  getTimeUntilNextClaim,
  canClaim as checkCanClaim,
} from '@/lib/waxApi';

const CHEESEBURNER_ACCOUNT = 'cheeseburner';
const ALCOR_POOL_ID = 1252;
const REFRESH_INTERVAL = 30000; // 30 seconds

interface WaxData {
  claimableWax: number;
  estimatedCheese: number;
  cheeseBurnAmount: number;       // 85% of CHEESE
  cheeseLiquidityAmount: number;  // 15% of CHEESE
  waxStakeAmount: number;         // 20% of WAX staked to CPU
  waxCheesepowerzAmount: number;  // 5% of WAX sent to cheesepowerz
  cheesePerWax: number;
  canClaim: boolean;
  timeUntilNextClaim: number;
  lastClaimTime: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useWaxData(): WaxData {
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<number>(0);

  // Fetch Alcor pool price data
  const poolQuery = useQuery({
    queryKey: ['alcorPool', ALCOR_POOL_ID],
    queryFn: () => fetchAlcorPoolPrice(ALCOR_POOL_ID),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  // Fetch voter info for last_claim_time and unpaid_voteshare
  const voterQuery = useQuery({
    queryKey: ['voterInfo', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchVoterInfo(CHEESEBURNER_ACCOUNT),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  // Fetch global state for voters_bucket and total_unpaid_voteshare
  const globalQuery = useQuery({
    queryKey: ['globalState'],
    queryFn: () => fetchGlobalState(),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  // Use last_claim_time for cooldown (only updates on actual claimgbmvote, not on staking)
  const lastClaimTime = voterQuery.data?.last_claim_time ?? null;

  // Update countdown timer every second
  useEffect(() => {
    if (!lastClaimTime) return;

    const updateTimer = () => {
      setTimeUntilNextClaim(getTimeUntilNextClaim(lastClaimTime));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [lastClaimTime]);

  // Calculate claimable rewards from voter and global state
  const claimableWax = useMemo(() => {
    if (!voterQuery.data || !globalQuery.data) return 0;
    return calculateClaimableRewards(voterQuery.data, globalQuery.data);
  }, [voterQuery.data, globalQuery.data]);

  const cheesePerWax = poolQuery.data ? calculateCheesePerWax(poolQuery.data) : 0;
  
  // Calculate distribution breakdown
  // 20% of WAX goes to CPU stake
  const waxStakeAmount = claimableWax * 0.20;
  
  // 5% of WAX goes to cheesepowerz
  const waxCheesepowerzAmount = claimableWax * 0.05;
  
  // 75% of WAX is swapped for CHEESE
  const waxToSwap = claimableWax * 0.75;
  const estimatedCheese = waxToSwap * cheesePerWax;
  
  // Of the swapped CHEESE:
  // - 85% is nulled
  // - 15% is xCHEESE (sent to xcheeseliqst)
  const cheeseBurnAmount = estimatedCheese * 0.85;
  const cheeseLiquidityAmount = estimatedCheese * 0.15;
  
  const canClaim = lastClaimTime ? checkCanClaim(lastClaimTime) : false;

  const refetch = () => {
    poolQuery.refetch();
    voterQuery.refetch();
    globalQuery.refetch();
  };

  return {
    claimableWax,
    estimatedCheese,
    cheeseBurnAmount,
    cheeseLiquidityAmount,
    waxStakeAmount,
    waxCheesepowerzAmount,
    cheesePerWax,
    canClaim,
    timeUntilNextClaim,
    lastClaimTime,
    isLoading: poolQuery.isLoading || voterQuery.isLoading || globalQuery.isLoading,
    isError: poolQuery.isError || voterQuery.isError || globalQuery.isError,
    error: poolQuery.error || voterQuery.error || globalQuery.error,
    refetch,
  };
}
