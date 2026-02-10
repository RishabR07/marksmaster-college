import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kpt.studentportal',
  appName: 'KPT Student Portal',
  webDir: 'dist',
  server: {
    // switched from Lovable project URL to local dev server
    url: "http://localhost:5173",
    cleartext: true
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1a1a2e",
      showSpinner: false
    },
    CapacitorUpdater: {
      autoUpdate: true,
      statsUrl: "",
      channelUrl: "",
      updateUrl: ""
    }
  }
};

export default config;
