import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kpt.studentportal',
  appName: 'KPT Student Portal',
  webDir: 'dist',
  server: {
    url: "https://daf5ba28-5d24-484b-a78d-eff57d3f0537.lovableproject.com?forceHideBadge=true",
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
