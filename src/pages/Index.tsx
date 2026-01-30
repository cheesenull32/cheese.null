import { useState } from "react";
import { BurnButton } from "@/components/BurnButton";
import { BurnStats } from "@/components/BurnStats";

const Index = () => {
  const [canClaim, setCanClaim] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-cheese-gradient tracking-wider">
          CHEESE BURNER
        </h1>
        <BurnStats onCanClaimChange={setCanClaim} />
        <BurnButton disabled={!canClaim} />
        <p className="text-muted-foreground text-sm">
          {canClaim ? "Click to claim & burn 🧀🔥" : "Waiting for cooldown ⏳"}
        </p>
      </div>
    </div>
  );
};

export default Index;
