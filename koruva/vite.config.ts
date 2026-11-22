import { defineConfig } from "vite";
import packageJson from "./package.json";

const displayVersion = packageJson.version.replace(/\.0$/, "");

export default defineConfig({
  root: "src/client",
  define: { __KORUVA_VERSION__: JSON.stringify(displayVersion) },
  build: { outDir: "../../dist/client", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 900 },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/ws": { target: "ws://localhost:8787", ws: true },
    },
  },
});
