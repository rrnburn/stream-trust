import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.dc0c16edc2904be38e5c1bebcf629426',
  appName: 'streaminstuff',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    // Increase memory allocation for large EPG files
    webContentsDebuggingEnabled: true,
    loggingBehavior: 'debug',
    buildOptions: {
      signingType: 'apksigner',
    },
  },
  server: {
    cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
    },
  },
};

export default config;
