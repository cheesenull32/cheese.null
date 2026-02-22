import { useState } from "react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/contexts/WalletContext";
import { useWaxData } from "@/hooks/useWaxData";
import { formatCountdown } from "@/lib/waxApi";
import { Loader2 } from "lucide-react";

interface BurnButtonProps {
  disabled?: boolean;
  onBurnSuccess?: () => void;
}

export const BurnButton = ({ disabled = false, onBurnSuccess }: BurnButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const { isConnected, isTransacting, transact, session } = useWallet();
  const { isPriorityWindow, isWhitelisted, priorityTimeRemaining } = useWaxData();

  const isContractUpdating = true; // Temporary flag — remove when contract is redeployed
  const isPriorityBlocked = isPriorityWindow && !isWhitelisted;
  const isDisabled = disabled || !isConnected || isTransacting || isContractUpdating || isPriorityBlocked;

  const handleClick = async () => {
    if (isDisabled || !session) return;

    const callerName = session.actor.toString();
    
    const burnAction = {
      account: 'cheeseburner',
      name: 'burn',
      authorization: [{ 
        actor: callerName,
        permission: 'active' 
      }],
      data: {
        caller: callerName
      },
    };

    const result = await transact([burnAction]);
    if (result && onBurnSuccess) {
      onBurnSuccess();
    }
  };

  const getButtonText = () => {
    if (isTransacting) {
      return (
        <span className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          NULLING...
        </span>
      );
    }
    return "NULL";
  };

  const getHintText = () => {
    if (isContractUpdating) return "⚙️ Contract being updated — please wait";
    if (!isConnected) return "Connect wallet first";
    if (isPriorityBlocked) return `🔒 Priority window — whitelisted accounts only (${formatCountdown(priorityTimeRemaining)})`;
    if (disabled) return "Waiting for cooldown";
    return null;
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
          !isDisabled && [
            "bg-cheese-gradient hover:bg-cheese-gradient-hover",
            "animate-pulse-cheese hover:cheese-glow-intense",
            "active:scale-95",
            "cursor-pointer",
            isPressed && "scale-95 cheese-glow-intense"
          ],
          isDisabled && [
            "bg-muted",
            "text-muted-foreground",
            "cursor-not-allowed",
            "opacity-60"
          ]
        )}
      >
        <span className="relative z-10 drop-shadow-lg">{getButtonText()}</span>
        
        {!isDisabled && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-transparent to-white/20 pointer-events-none" />
        )}
      </button>
      
      {getHintText() && (
        <span className="text-sm text-muted-foreground">{getHintText()}</span>
      )}
    </div>
  );
};
