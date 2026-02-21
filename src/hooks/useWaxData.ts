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
  cheeseBurnAmount: number;       // 75% of CHEESE (60% of original WAX value)
  cheeseLiquidityAmount: number;  // 12.5% of CHEESE (10% of original WAX value)
  cheeseRewardAmount: number;     // 12.5% of CHEESE (10% of original WAX value)
  waxStakeAmount: number;         // 15% of WAX staked to CPU
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
  // 15% of WAX goes to CPU stake
  const waxStakeAmount = claimableWax * 0.15;
  // 5% of WAX goes to cheesepowerz
  const waxCheesepowerzAmount = claimableWax * 0.05;
  
  // 80% of WAX is swapped for CHEESE
  const waxToSwap = claimableWax * 0.80;
  const estimatedCheese = waxToSwap * cheesePerWax;
  
  // Of the swapped CHEESE:
  // - 60/80 (75%) is nulled
  // - 10/80 (12.5%) is xCHEESE (sent to xcheeseliqst)
  // - 10/80 (12.5%) is caller reward
  const cheeseRewardAmount = estimatedCheese * (10 / 80);
  const cheeseLiquidityAmount = estimatedCheese * (10 / 80);
  const cheeseBurnAmount = estimatedCheese * (60 / 80);
  
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
    cheeseRewardAmount,
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
