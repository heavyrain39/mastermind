import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "fft.js": path.resolve(__dirname, "node_modules/fft.js/lib/fft.js")
    }
  },
  server: {
    fs: {
      allow: [".."]
    }
  },
  build: {
    reportCompressedSize: false
  }
});
