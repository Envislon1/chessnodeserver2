
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1c556585b02c4a02b5ddef2b2a3c2b60',
  appName: 'Technautic Inverter Control',
  webDir: 'dist',
  server: {
    url: 'https://1c556585-b02c-4a02-b5dd-ef2b2a3c2b60.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#orange",
    },
  }
};

export default config;
