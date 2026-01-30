import { useQuery } from '@tanstack/react-query';
import { 
  fetchWaxBalance, 
  fetchAlcorPoolPrice, 
  calculateCheesePerWax 
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

  // Calculate values using pool reserves
  const claimableWax = balanceQuery.data ?? 0;
  const cheesePerWax = poolQuery.data ? calculateCheesePerWax(poolQuery.data) : 0;
  const estimatedCheese = claimableWax * cheesePerWax;

  const refetch = () => {
    balanceQuery.refetch();
    poolQuery.refetch();
  };

  return {
    claimableWax,
    estimatedCheese,
    cheesePerWax,
    isLoading: balanceQuery.isLoading || poolQuery.isLoading,
    isError: balanceQuery.isError || poolQuery.isError,
    error: balanceQuery.error || poolQuery.error,
    refetch,
  };
}
