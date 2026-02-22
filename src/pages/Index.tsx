import { useState } from "react";
import { BurnButton } from "@/components/BurnButton";
import { BurnStats } from "@/components/BurnStats";
import { TotalStats } from "@/components/TotalStats";
import { WalletButton } from "@/components/WalletButton";

const Index = () => {
  const [canClaim, setCanClaim] = useState(false);

  const handleBurnSuccess = () => {
    // Trigger a refetch of data after successful burn
    // The BurnStats component will auto-refresh via react-query
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        {/* Wallet Connection */}
        <WalletButton />
        
        <h1 className="text-2xl font-bold text-cheese-gradient tracking-wider">
          CHEESE.Null
        </h1>
        
        <BurnStats onCanClaimChange={setCanClaim} />
        
        <BurnButton disabled={!canClaim} onBurnSuccess={handleBurnSuccess} />
        
        <p className="text-muted-foreground text-sm">
          {canClaim ? "Click to claim & burn 🧀🔥" : "Waiting for cooldown ⏳"}
        </p>

        <TotalStats />
      </div>
    </div>
  );
};

export default Index;
