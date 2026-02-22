import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { 
  fetchAlcorPoolPrice, 
  fetchVoterInfo,
  fetchGlobalState,
  fetchContractConfig,
  fetchWhitelist,
  fetchBurnTrack,
  calculateCheesePerWax,
  calculateClaimableRewards,
  getTimeUntilNextClaim,
  canClaim as checkCanClaim,
} from '@/lib/waxApi';
import { useWallet } from '@/contexts/WalletContext';

const CHEESEBURNER_ACCOUNT = 'cheeseburner';
const ALCOR_POOL_ID = 1252;
const REFRESH_INTERVAL = 30000; // 30 seconds

interface WaxData {
  claimableWax: number;
  estimatedCheese: number;
  cheeseBurnAmount: number;
  cheeseRewardAmount: number;
  cheeseLiquidityAmount: number;
  waxStakeAmount: number;
  cheesePerWax: number;
  canClaim: boolean;
  timeUntilNextClaim: number;
  lastClaimTime: string | null;
  isPriorityWindow: boolean;
  isWhitelisted: boolean;
  priorityTimeRemaining: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useWaxData(): WaxData {
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<number>(0);
  const [priorityTimeRemaining, setPriorityTimeRemaining] = useState<number>(0);
  const { session } = useWallet();
  const walletAccount = session?.actor?.toString() ?? null;

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

  // Fetch contract config for priority_window
  const configQuery = useQuery({
    queryKey: ['contractConfig', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchContractConfig(CHEESEBURNER_ACCOUNT),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  // Fetch whitelist
  const whitelistQuery = useQuery({
    queryKey: ['whitelist', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchWhitelist(CHEESEBURNER_ACCOUNT),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  // Fetch burn track for last_burn timestamp
  const burnTrackQuery = useQuery({
    queryKey: ['burnTrack', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchBurnTrack(CHEESEBURNER_ACCOUNT),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  const lastClaimTime = voterQuery.data?.last_claim_time ?? null;

  // Calculate priority window state
  const priorityWindow = configQuery.data?.priority_window ?? 172800;
  const lastBurnTime = burnTrackQuery.data?.last_burn ?? null;

  const isPriorityWindow = useMemo(() => {
    if (!lastBurnTime) return false;
    const lastBurnMs = new Date(lastBurnTime + 'Z').getTime();
    const elapsed = (Date.now() - lastBurnMs) / 1000;
    return elapsed < priorityWindow;
  }, [lastBurnTime, priorityWindow]);

  const isWhitelisted = useMemo(() => {
    if (!walletAccount || !whitelistQuery.data) return false;
    return whitelistQuery.data.some(row => row.account === walletAccount);
  }, [walletAccount, whitelistQuery.data]);

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

  // Update priority window countdown every second
  useEffect(() => {
    if (!lastBurnTime) {
      setPriorityTimeRemaining(0);
      return;
    }
    const updatePriority = () => {
      const lastBurnMs = new Date(lastBurnTime + 'Z').getTime();
      const endMs = lastBurnMs + priorityWindow * 1000;
      setPriorityTimeRemaining(Math.max(0, endMs - Date.now()));
    };
    updatePriority();
    const interval = setInterval(updatePriority, 1000);
    return () => clearInterval(interval);
  }, [lastBurnTime, priorityWindow]);

  // Calculate claimable rewards from voter and global state
  const claimableWax = useMemo(() => {
    if (!voterQuery.data || !globalQuery.data) return 0;
    return calculateClaimableRewards(voterQuery.data, globalQuery.data);
  }, [voterQuery.data, globalQuery.data]);

  const cheesePerWax = poolQuery.data ? calculateCheesePerWax(poolQuery.data) : 0;
  
  const waxStakeAmount = claimableWax * 0.20;
  const waxToSwap = claimableWax * 0.80;
  const estimatedCheese = waxToSwap * cheesePerWax;
  const cheeseBurnAmount = estimatedCheese * (63 / 80);
  const cheeseRewardAmount = estimatedCheese * (10 / 80);
  const cheeseLiquidityAmount = estimatedCheese * (7 / 80);
  
  const canClaim = lastClaimTime ? checkCanClaim(lastClaimTime) : false;

  const refetch = () => {
    poolQuery.refetch();
    voterQuery.refetch();
    globalQuery.refetch();
    configQuery.refetch();
    whitelistQuery.refetch();
    burnTrackQuery.refetch();
  };

  return {
    claimableWax,
    estimatedCheese,
    cheeseBurnAmount,
    cheeseRewardAmount,
    cheeseLiquidityAmount,
    waxStakeAmount,
    cheesePerWax,
    canClaim,
    timeUntilNextClaim,
    lastClaimTime,
    isPriorityWindow,
    isWhitelisted,
    priorityTimeRemaining,
    isLoading: poolQuery.isLoading || voterQuery.isLoading || globalQuery.isLoading,
    isError: poolQuery.isError || voterQuery.isError || globalQuery.isError,
    error: poolQuery.error || voterQuery.error || globalQuery.error,
    refetch,
  };
}
