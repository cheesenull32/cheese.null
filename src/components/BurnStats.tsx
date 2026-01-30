import { RefreshCw } from 'lucide-react';
import { useWaxData } from '@/hooks/useWaxData';
import { formatWaxAmount, formatCheeseAmount } from '@/lib/waxApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const BurnStats = () => {
  const { claimableWax, estimatedCheese, isLoading, isError, refetch } = useWaxData();

  return (
    <Card className="w-full max-w-md bg-card/80 backdrop-blur border-cheese/20 cheese-glow">
      <CardContent className="p-6 space-y-6">
        {/* Claimable WAX Section */}
        <div className="text-center space-y-2">
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Claimable Vote Rewards
          </h3>
          {isLoading ? (
            <Skeleton className="h-10 w-48 mx-auto bg-muted" />
          ) : isError ? (
            <p className="text-destructive text-sm">Error loading data</p>
          ) : (
            <p className="text-3xl font-bold text-cheese-gradient">
              {formatWaxAmount(claimableWax)} <span className="text-lg text-muted-foreground">WAX</span>
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-cheese/10" />

        {/* Estimated CHEESE Section */}
        <div className="text-center space-y-2">
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Estimated Cheese Burn
          </h3>
          {isLoading ? (
            <Skeleton className="h-10 w-56 mx-auto bg-muted" />
          ) : isError ? (
            <p className="text-destructive text-sm">Error loading data</p>
          ) : (
            <p className="text-3xl font-bold text-cheese-gradient">
              {formatCheeseAmount(estimatedCheese)} <span className="text-lg text-muted-foreground">CHEESE</span>
            </p>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={refetch}
          disabled={isLoading}
          className={cn(
            "flex items-center justify-center gap-2 mx-auto",
            "text-xs text-muted-foreground hover:text-cheese transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </CardContent>
    </Card>
  );
};
