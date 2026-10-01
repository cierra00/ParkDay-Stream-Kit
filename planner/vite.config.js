import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Every build gets a version stamp. The app compares it with /version.json to know when to reload itself.
const BUILD = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), { name: "version-json", generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD }) }); } }],
  build: { outDir: "dist", sourcemap: false },
});
