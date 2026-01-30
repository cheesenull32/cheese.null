import { useState } from "react";
import { cn } from "@/lib/utils";

interface BurnButtonProps {
  disabled?: boolean;
}

export const BurnButton = ({ disabled = false }: BurnButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const [burnCount, setBurnCount] = useState(0);

  const handleClick = () => {
    if (disabled) return;
    setBurnCount((prev) => prev + 1);
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      disabled={disabled}
      className={cn(
        "relative px-16 py-6 rounded-xl",
        "text-primary-foreground font-black text-4xl tracking-widest",
        "transition-all duration-150 ease-out",
        "focus:outline-none focus:ring-4 focus:ring-primary/50",
        "select-none",
        // Active state (when claim is available)
        !disabled && [
          "bg-cheese-gradient hover:bg-cheese-gradient-hover",
          "animate-pulse-cheese hover:cheese-glow-intense",
          "active:scale-95",
          "cursor-pointer",
          isPressed && "scale-95 cheese-glow-intense"
        ],
        // Disabled state (on cooldown)
        disabled && [
          "bg-muted",
          "text-muted-foreground",
          "cursor-not-allowed",
          "opacity-60"
        ]
      )}
    >
      <span className="relative z-10 drop-shadow-lg">BURN</span>
      
      {/* Inner highlight - only show when active */}
      {!disabled && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-transparent to-white/20 pointer-events-none" />
      )}
      
      {/* Burn counter */}
      {burnCount > 0 && (
        <span className="absolute -top-3 -right-3 bg-secondary text-foreground text-sm font-bold px-3 py-1 rounded-full border border-border">
          {burnCount}
        </span>
      )}
    </button>
  );
};
