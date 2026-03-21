import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "app/frontend-modern",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('react/') ||
            id.includes('react-dom/') ||
            id.includes('react-router-dom/') ||
            id.includes('scheduler/')
          ) {
            return 'framework';
          }

          if (id.includes('pdfjs-dist/') || id.includes('tesseract.js/')) {
            return 'document-ai';
          }

          if (id.includes('@anthropic-ai/sdk/')) {
            return 'ai-sdk';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/tests/**/*.test.{js,jsx}"],
  },
  server: {
    port: 5173,
    hmr: {
      overlay: false
    },
    proxy: {
      "/api": "http://localhost:4000",
      "/health": "http://localhost:4000"
    }
  }
});
