import { useQuery } from '@tanstack/react-query';
import { fetchCheesepowerzTotal } from '@/lib/waxApi';

export function useCheesepowerzTotal() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cheesepowerzTotal'],
    queryFn: fetchCheesepowerzTotal,
    refetchInterval: 60000,
    staleTime: 60000,
  });

  return {
    totalWaxCheesepowerz: data ?? 0,
    isLoading,
    isError,
  };
}
