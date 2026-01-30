import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { 
  fetchWaxBalance, 
  fetchAlcorPoolPrice, 
  fetchVoterInfo,
  calculateCheesePerWax,
  getTimeUntilNextClaim,
  canClaim as checkCanClaim,
} from '@/lib/waxApi';

const CHEESEBURNER_ACCOUNT = 'cheeseburner';
const ALCOR_POOL_ID = 1252;
const REFRESH_INTERVAL = 30000; // 30 seconds

interface WaxData {
  claimableWax: number;
  estimatedCheese: number;
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

  // Fetch WAX balance from eosio.token accounts table
  const balanceQuery = useQuery({
    queryKey: ['waxBalance', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchWaxBalance(CHEESEBURNER_ACCOUNT),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  // Fetch Alcor pool price data
  const poolQuery = useQuery({
    queryKey: ['alcorPool', ALCOR_POOL_ID],
    queryFn: () => fetchAlcorPoolPrice(ALCOR_POOL_ID),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  // Fetch voter info for last_claim_time
  const voterQuery = useQuery({
    queryKey: ['voterInfo', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchVoterInfo(CHEESEBURNER_ACCOUNT),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

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

  // Calculate values using pool reserves
  const claimableWax = balanceQuery.data ?? 0;
  const cheesePerWax = poolQuery.data ? calculateCheesePerWax(poolQuery.data) : 0;
  const estimatedCheese = claimableWax * cheesePerWax;
  const canClaim = lastClaimTime ? checkCanClaim(lastClaimTime) : false;

  const refetch = () => {
    balanceQuery.refetch();
    poolQuery.refetch();
    voterQuery.refetch();
  };

  return {
    claimableWax,
    estimatedCheese,
    cheesePerWax,
    canClaim,
    timeUntilNextClaim,
    lastClaimTime,
    isLoading: balanceQuery.isLoading || poolQuery.isLoading || voterQuery.isLoading,
    isError: balanceQuery.isError || poolQuery.isError || voterQuery.isError,
    error: balanceQuery.error || poolQuery.error || voterQuery.error,
    refetch,
  };
}
