import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

export default defineConfig({
    base: "./",
    plugins: [
        react(),
        {
            name: "copy-manifest",
            closeBundle() {
                fs.copyFileSync(
                    path.resolve(__dirname, "src/extension/manifest.json"),
                    path.resolve(__dirname, "dist-ext/manifest.json")
                );
            }
        }
    ],
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
        outDir: "dist-ext",
        emptyOutDir: true,
        reportCompressedSize: false,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, "index.html"),
                background: path.resolve(__dirname, "src/extension/background.ts")
            },
            output: {
                entryFileNames: (assetInfo) => {
                    if (assetInfo.name === 'background') {
                        return 'background.js';
                    }
                    return 'assets/[name]-[hash].js';
                }
            }
        }
    }
});
