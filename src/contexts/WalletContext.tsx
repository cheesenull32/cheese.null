import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session, TransactResult } from '@wharfkit/session';
import { sessionKit } from '@/lib/wharfkit';
import { toast } from '@/hooks/use-toast';

interface WalletContextType {
  session: Session | null;
  isConnected: boolean;
  isLoading: boolean;
  isTransacting: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  transact: (actions: any[]) => Promise<TransactResult | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransacting, setIsTransacting] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const restored = await sessionKit.restore();
        if (restored) {
          setSession(restored);
        }
      } catch (error) {
        // Silent fail on restore - user will need to login again
        console.log('No previous session to restore');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await sessionKit.login();
      setSession(response.session);
      toast({
        title: 'Wallet Connected',
        description: `Connected as ${response.session.actor.toString()}`,
      });
    } catch (error: any) {
      if (error.message?.includes('cancelled') || error.message?.includes('closed')) {
        // User cancelled - no toast needed
        return;
      }
      console.error('Login error:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (session) {
        await sessionKit.logout(session);
      }
      setSession(null);
      toast({
        title: 'Wallet Disconnected',
        description: 'Successfully disconnected wallet',
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      // Still clear session even if logout fails
      setSession(null);
    }
  }, [session]);

  const transact = useCallback(async (actions: any[]): Promise<TransactResult | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setIsTransacting(true);
      const result = await session.transact({ actions });
      toast({
        title: 'Transaction Successful',
        description: 'Your transaction was submitted successfully',
      });
      return result;
    } catch (error: any) {
      if (error.message?.includes('cancelled') || error.message?.includes('rejected')) {
        toast({
          title: 'Transaction Cancelled',
          description: 'You cancelled the transaction',
        });
        return null;
      }
      console.error('Transaction error:', error);
      toast({
        title: 'Transaction Failed',
        description: error.message || 'Failed to submit transaction',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsTransacting(false);
    }
  }, [session]);

  const value: WalletContextType = {
    session,
    isConnected: !!session,
    isLoading,
    isTransacting,
    login,
    logout,
    transact,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
