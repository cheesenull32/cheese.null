import { useState } from "react";
import { cn } from "@/lib/utils";

export const BurnButton = () => {
  const [isPressed, setIsPressed] = useState(false);
  const [burnCount, setBurnCount] = useState(0);

  const handleClick = () => {
    setBurnCount((prev) => prev + 1);
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={cn(
        "relative px-16 py-6 rounded-xl",
        "bg-cheese-gradient hover:bg-cheese-gradient-hover",
        "text-primary-foreground font-black text-4xl tracking-widest",
        "transition-all duration-150 ease-out",
        "animate-pulse-cheese hover:cheese-glow-intense",
        "active:scale-95",
        "focus:outline-none focus:ring-4 focus:ring-primary/50",
        "select-none cursor-pointer",
        isPressed && "scale-95 cheese-glow-intense"
      )}
    >
      <span className="relative z-10 drop-shadow-lg">BURN</span>
      
      {/* Inner highlight */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-transparent to-white/20 pointer-events-none" />
      
      {/* Burn counter */}
      {burnCount > 0 && (
        <span className="absolute -top-3 -right-3 bg-secondary text-foreground text-sm font-bold px-3 py-1 rounded-full border border-border">
          {burnCount}
        </span>
      )}
    </button>
  );
};
