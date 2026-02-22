import { SessionKit, Chains } from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';

// WAX Mainnet chain configuration
const WAX_CHAIN = Chains.WAX;

// Create and export the SessionKit instance
export const sessionKit = new SessionKit({
  appName: 'CHEESE Burner',
  chains: [WAX_CHAIN],
  ui: new WebRenderer(),
  walletPlugins: [
    new WalletPluginAnchor(),
    new WalletPluginCloudWallet(),
  ],
});
