import { BurnButton } from "@/components/BurnButton";
import { BurnStats } from "@/components/BurnStats";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-cheese-gradient tracking-wider">
          CHEESE BURNER
        </h1>
        <BurnStats />
        <BurnButton />
        <p className="text-muted-foreground text-sm">Click to claim & burn 🧀🔥</p>
      </div>
    </div>
  );
};

export default Index;
