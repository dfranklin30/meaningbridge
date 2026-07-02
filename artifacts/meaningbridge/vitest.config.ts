import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Standalone test config: the app's vite.config.ts requires PORT/BASE_PATH env
// (workflow-provided) and would throw here, so tests get their own minimal
// config that only mirrors the "@" alias and the React plugin.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.tsx", "test/**/*.test.ts"],
    css: false,
  },
});
