import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Loader2 } from 'lucide-react';

export function WalletButton() {
  const { session, isConnected, isLoading, login, logout } = useWallet();

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (isConnected && session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">
          👤 {session.actor.toString()}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={login}
      className="gap-2 bg-primary hover:bg-primary/90"
    >
      <Wallet className="h-4 w-4" />
      Connect Wallet
    </Button>
  );
}
