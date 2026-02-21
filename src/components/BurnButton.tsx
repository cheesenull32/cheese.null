import { useState } from "react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/contexts/WalletContext";
import { Loader2 } from "lucide-react";

interface BurnButtonProps {
  disabled?: boolean;
  onBurnSuccess?: () => void;
}

export const BurnButton = ({ disabled = false, onBurnSuccess }: BurnButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const { isConnected, isTransacting, transact, session } = useWallet();

  const isDisabled = true; // Contract being updated

  const handleClick = async () => {
    return; // Disabled during contract update
  };

  const getButtonText = () => {
    return "NULL";
  };

  const getHintText = () => {
    if (!isConnected) return "Connect wallet first";
    return "Please wait — contract being updated";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        onMouseDown={() => !isDisabled && setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        disabled={isDisabled}
        className={cn(
          "relative px-16 py-6 rounded-xl",
          "text-primary-foreground font-black text-4xl tracking-widest",
          "transition-all duration-150 ease-out",
          "focus:outline-none focus:ring-4 focus:ring-primary/50",
          "select-none",
          // Active state (when claim is available and connected)
          !isDisabled && [
            "bg-cheese-gradient hover:bg-cheese-gradient-hover",
            "animate-pulse-cheese hover:cheese-glow-intense",
            "active:scale-95",
            "cursor-pointer",
            isPressed && "scale-95 cheese-glow-intense"
          ],
          // Disabled state (on cooldown or not connected)
          isDisabled && [
            "bg-muted",
            "text-muted-foreground",
            "cursor-not-allowed",
            "opacity-60"
          ]
        )}
      >
        <span className="relative z-10 drop-shadow-lg">{getButtonText()}</span>
        
        {/* Inner highlight - only show when active */}
        {!isDisabled && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-transparent to-white/20 pointer-events-none" />
        )}
      </button>
      
      {/* Hint text when disabled */}
      {getHintText() && (
        <span className="text-sm text-muted-foreground">{getHintText()}</span>
      )}
    </div>
  );
};
