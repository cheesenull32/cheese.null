
# Add WAX Cloud Wallet Support

## Overview
WAX Cloud Wallet (also known as MyCloudWallet) is the most popular wallet for WAX users. Adding it alongside Anchor gives users a choice at login. This is a one-package install and a two-line code change.

## What Changes

### 1. Install `@wharfkit/wallet-plugin-cloudwallet`
The official WharfKit plugin for MyCloudWallet.com. It handles the OAuth-style popup login flow that WAX Cloud Wallet uses.

### 2. Update `src/lib/wharfkit.ts`
Add the new plugin to the `walletPlugins` array alongside the existing Anchor plugin:

```ts
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';

export const sessionKit = new SessionKit({
  appName: 'CHEESE Burner',
  chains: [WAX_CHAIN],
  ui: new WebRenderer(),
  walletPlugins: [
    new WalletPluginAnchor(),
    new WalletPluginCloudWallet(),
  ],
});
```

WharfKit's built-in `WebRenderer` UI automatically presents both options in a wallet selection modal when the user clicks "Connect Wallet" -- no changes needed to `WalletButton.tsx`, `WalletContext.tsx`, or any other file.

## How It Works for Users
- User clicks "Connect Wallet"
- WharfKit shows a modal with two options: Anchor and WAX Cloud Wallet
- User picks their preferred wallet
- Login and transaction signing work identically for both -- the rest of the app is unaffected

## Files Summary

| File | Change |
|---|---|
| `package.json` | Add `@wharfkit/wallet-plugin-cloudwallet` dependency |
| `src/lib/wharfkit.ts` | Import and register `WalletPluginCloudWallet` |

That's it -- no other files need to change.
