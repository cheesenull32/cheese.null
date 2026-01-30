

# Anchor Wallet Integration with WharfKit

## Overview
Add WAX blockchain wallet connectivity using WharfKit's SessionKit with the Anchor wallet plugin. Users will be able to connect their wallet and trigger the `burn()` action on the `cheeseburner` smart contract.

## User Experience Flow

```text
+---------------------------------------+
|          CHEESE BURNER                |
+---------------------------------------+
|                                       |
|    [🔗 Connect Wallet]                |  <-- When not connected
|                                       |
|    Claimable Vote Rewards             |
|         2.60796579 WAX                |
|                                       |
|    Estimated CHEESE Burn              |
|           1.5930 CHEESE               |
|                                       |
|    Next claim in: 16h 12m 5s          |
|                                       |
|    [BURN] (disabled - no wallet)      |
|                                       |
+---------------------------------------+

                 ↓ User connects wallet

+---------------------------------------+
|          CHEESE BURNER                |
+---------------------------------------+
|                                       |
|    👤 mywaxaccount                    |  <-- Logged in state
|    [Disconnect]                       |
|                                       |
|    Claimable Vote Rewards             |
|         2.60796579 WAX                |
|                                       |
|    Estimated CHEESE Burn              |
|           1.5930 CHEESE               |
|                                       |
|    Ready to claim!                    |
|                                       |
|    [BURN] (enabled & clickable)       |
|                                       |
+---------------------------------------+
```

## Technical Architecture

### Package Dependencies
The following npm packages will be added:
- `@wharfkit/session` - Core session management
- `@wharfkit/wallet-plugin-anchor` - Anchor wallet integration  
- `@wharfkit/web-renderer` - Login UI modal

### New Files

**1. `src/lib/wharfkit.ts`** - WharfKit SessionKit Configuration
- Initialize SessionKit with WAX mainnet chain configuration
- Configure Anchor wallet plugin
- Export the singleton SessionKit instance

**2. `src/contexts/WalletContext.tsx`** - React Context for Wallet State
- Manages wallet connection state across the app
- Provides: `session`, `isConnected`, `login()`, `logout()`, `transact()`
- Automatically attempts to restore previous session on mount

**3. `src/components/WalletButton.tsx`** - Connect/Disconnect UI
- Shows "Connect Wallet" button when not connected
- Shows account name + "Disconnect" when connected
- Triggers Anchor login modal on click

### Modified Files

**4. `src/App.tsx`**
- Wrap app with `WalletProvider` context

**5. `src/components/BurnButton.tsx`**
- Use wallet context to check connection
- Add `onClick` handler that calls `cheeseburner::burn()` action
- Disable if not connected OR if cooldown active
- Show loading state during transaction

**6. `src/pages/Index.tsx`**
- Add `WalletButton` component to header area
- Pass wallet connection status to burn logic

### Data Flow

```text
User clicks             WharfKit              Anchor             WAX
"Connect Wallet"        SessionKit            Wallet            Blockchain
      |                     |                   |                  |
      |-- login() --------->|                   |                  |
      |                     |-- QR/deep link -->|                  |
      |                     |<-- session -------|                  |
      |<-- session data ----|                   |                  |
      |                     |                   |                  |
      |                     |                   |                  |
User clicks "BURN"          |                   |                  |
      |                     |                   |                  |
      |-- transact() ------>|                   |                  |
      |                     |-- sign request -->|                  |
      |                     |<-- signature -----|                  |
      |                     |-- push tx --------------------------->|
      |<-- tx result -------|                   |                  |
```

## Implementation Details

### SessionKit Configuration

```typescript
// src/lib/wharfkit.ts
import { SessionKit } from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';

const WAX_CHAIN = {
  id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  url: 'https://wax.greymass.com',
};

export const sessionKit = new SessionKit({
  appName: 'CHEESE Burner',
  chains: [WAX_CHAIN],
  ui: new WebRenderer(),
  walletPlugins: [new WalletPluginAnchor()],
});
```

### Wallet Context

```typescript
// src/contexts/WalletContext.tsx
interface WalletContextType {
  session: Session | null;
  isConnected: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  transact: (actions: Action[]) => Promise<TransactResult>;
}
```

### Burn Transaction

```typescript
// When user clicks BURN button
const burnAction = {
  account: 'cheeseburner',
  name: 'burn',
  authorization: [session.permissionLevel],
  data: {},  // burn() action takes no parameters
};

await session.transact({ actions: [burnAction] });
```

### Button States

| Condition | Button State | Appearance |
|-----------|-------------|------------|
| Not connected | Disabled | Grey, "Connect wallet first" |
| Connected + Cooldown active | Disabled | Grey, shows countdown |
| Connected + Ready to claim | Enabled | Yellow gradient, clickable |
| Transaction pending | Disabled | Shows spinner |

## Implementation Order

1. Install WharfKit packages
2. Create `src/lib/wharfkit.ts` - SessionKit setup
3. Create `src/contexts/WalletContext.tsx` - React context
4. Create `src/components/WalletButton.tsx` - UI component
5. Update `src/App.tsx` - Add WalletProvider wrapper
6. Update `src/components/BurnButton.tsx` - Add transaction logic
7. Update `src/pages/Index.tsx` - Integrate wallet button
8. Test wallet connection and transaction flow

## Error Handling

- Connection failures: Show toast notification
- Transaction rejections: User-friendly message ("Transaction cancelled")
- Network errors: Retry option with error details
- Session restoration failures: Silent fail, show login button

