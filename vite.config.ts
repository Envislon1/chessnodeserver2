
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Conditionally load componentTagger only when in development mode
    // and when it's available, using dynamic import to handle ESM module
    mode === 'development' && {
      name: 'lovable-tagger-wrapper',
      async configResolved() {
        try {
          // Dynamically import the ESM module
          const module = await import('lovable-tagger');
          if (module.componentTagger) {
            return module.componentTagger();
          }
        } catch (e) {
          console.warn('Could not load lovable-tagger, continuing without it:', e);
        }
      }
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    // Ensures proper Electron compatibility
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
  },
  // Always use relative paths for Electron builds
  base: process.env.IS_ELECTRON === 'true' ? './' : '/',
}));
