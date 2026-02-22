import { Gift, TrendingUp, Droplet, Flame, Zap } from 'lucide-react';
import { useContractStats } from '@/hooks/useContractStats';
import { useCheesepowerzTotal } from '@/hooks/useCheesepowerzTotal';
import { formatWaxAmount, formatCheeseAmount } from '@/lib/waxApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const TotalStats = () => {
  const {
    totalBurns,
    totalCheeseNulled,
    totalCheeseRewards,
    totalCheeseLiquidity,
    totalWaxCompounded,
    isLoading,
    isError,
  } = useContractStats();
  const { totalWaxCheesepowerz, isLoading: isPowerzLoading } = useCheesepowerzTotal();

  return (
    <Card className="w-full max-w-md bg-card/60 backdrop-blur border-cheese/10">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Lifetime Statistics
          </h3>
        </div>

        {/* Total CHEESE Nulled */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Total CHEESE Nulled</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-40 mx-auto bg-muted" />
          ) : isError ? (
            <p className="text-muted-foreground text-xs">Stats temporarily unavailable</p>
          ) : (
            <p className="text-xl font-bold text-cheese-gradient">
              {formatCheeseAmount(totalCheeseNulled)} <span className="text-sm text-muted-foreground">CHEESE</span>
            </p>
          )}
        </div>

        {/* Distribution Breakdown */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {/* Rewards */}
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Gift className="w-3 h-3" />
                <span className="text-[10px] font-medium">Rewards</span>
              </div>
              <p className="text-xs font-semibold text-cheese">
                {formatCheeseAmount(totalCheeseRewards)}
              </p>
              <p className="text-[10px] text-muted-foreground">CHEESE</p>
            </div>

            {/* xCHEESE */}
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Droplet className="w-3 h-3" />
                <span className="text-[10px] font-medium">xCHEESE</span>
              </div>
              <p className="text-xs font-semibold text-cheese">
                {formatCheeseAmount(totalCheeseLiquidity)}
              </p>
              <p className="text-[10px] text-muted-foreground">CHEESE</p>
            </div>

            {/* CheesePowerz */}
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span className="text-[10px] font-medium">CheesePowerz</span>
              </div>
              {isPowerzLoading ? (
                <Skeleton className="h-4 w-16 mx-auto bg-muted" />
              ) : (
                <p className="text-xs font-semibold text-cheese">
                  {formatWaxAmount(totalWaxCheesepowerz)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">WAX</p>
            </div>

            {/* Compound */}
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] font-medium">Compound</span>
              </div>
              <p className="text-xs font-semibold text-cheese">
                {formatWaxAmount(totalWaxCompounded)}
              </p>
              <p className="text-[10px] text-muted-foreground">WAX</p>
            </div>
          </div>
        )}

        {/* Total Nulls Count */}
        {!isLoading && (
          <div className="text-center pt-1 border-t border-cheese/10">
            <p className="text-xs text-muted-foreground">
              Total Nulls: <span className="font-semibold text-cheese">{totalBurns.toLocaleString()}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
