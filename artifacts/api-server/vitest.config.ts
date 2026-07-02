import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Integration tests share one real dev database connection; run serially so
    // fixtures created in one file never race another.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
