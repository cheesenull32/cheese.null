import { useQuery } from '@tanstack/react-query';
import { fetchContractStats, fetchCheesepowerzStats, parseAssetAmount } from '@/lib/waxApi';

const CONTRACT_ACCOUNT = 'cheeseburner';

export interface ContractStatsData {
  totalBurns: number;
  totalCheeseNulled: number;
  totalCheeseRewards: number;
  totalCheeseLiquidity: number;
  totalWaxCompounded: number;
  totalWaxCheesepowerz: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useContractStats(): ContractStatsData {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contractStats', CONTRACT_ACCOUNT],
    queryFn: () => fetchContractStats(CONTRACT_ACCOUNT),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const cpowerQuery = useQuery({
    queryKey: ['cheesepowerzStats', CONTRACT_ACCOUNT],
    queryFn: () => fetchCheesepowerzStats(CONTRACT_ACCOUNT),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return {
    totalBurns: data?.total_burns ?? 0,
    totalCheeseNulled: parseAssetAmount(data?.total_cheese_burned ?? ''),
    totalCheeseRewards: parseAssetAmount(data?.total_cheese_rewards ?? ''),
    totalCheeseLiquidity: parseAssetAmount(data?.total_cheese_liquidity ?? ''),
    totalWaxCompounded: parseAssetAmount(data?.total_wax_staked ?? ''),
    totalWaxCheesepowerz: parseAssetAmount(cpowerQuery.data?.total_wax_cheesepowerz ?? ''),
    isLoading: isLoading || cpowerQuery.isLoading,
    isError: isError || cpowerQuery.isError,
    refetch: () => { refetch(); cpowerQuery.refetch(); },
  };
}
