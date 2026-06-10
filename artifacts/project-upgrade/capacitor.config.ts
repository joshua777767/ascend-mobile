import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ascend.fitness',
  appName: 'Ascend',
  webDir: 'dist/public',
  server: {
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    PurchasesCapacitor: {
      apiKey: process.env.REVENUECAT_IOS_API_KEY || '',
    },
  },
};

export default config;
