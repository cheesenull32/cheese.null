import { BurnButton } from "@/components/BurnButton";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <BurnButton />
        <p className="text-muted-foreground text-sm">Click to burn 🔥</p>
      </div>
    </div>
  );
};

export default Index;
