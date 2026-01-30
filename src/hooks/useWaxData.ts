import { useQuery } from '@tanstack/react-query';
import { 
  fetchVoterRewards, 
  fetchAlcorPoolPrice, 
  parseUnpaidVoteshare 
} from '@/lib/waxApi';

const CHEESEBURNER_ACCOUNT = 'cheeseburner';
const ALCOR_POOL_ID = 1252;
const REFRESH_INTERVAL = 30000; // 30 seconds

interface WaxData {
  claimableWax: number;
  estimatedCheese: number;
  cheesePerWax: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useWaxData(): WaxData {
  // Fetch voter rewards data
  const voterQuery = useQuery({
    queryKey: ['voterRewards', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchVoterRewards(CHEESEBURNER_ACCOUNT),
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

  // Calculate values
  const claimableWax = voterQuery.data 
    ? parseUnpaidVoteshare(voterQuery.data.unpaid_voteshare) 
    : 0;
  
  const cheesePerWax = poolQuery.data?.priceB ?? 0;
  const estimatedCheese = claimableWax * cheesePerWax;

  const refetch = () => {
    voterQuery.refetch();
    poolQuery.refetch();
  };

  return {
    claimableWax,
    estimatedCheese,
    cheesePerWax,
    isLoading: voterQuery.isLoading || poolQuery.isLoading,
    isError: voterQuery.isError || poolQuery.isError,
    error: voterQuery.error || poolQuery.error,
    refetch,
  };
}
