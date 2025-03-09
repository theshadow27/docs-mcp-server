import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    testTimeout: 5000,
    include: ["src/**/*.test.ts"],
  },
});
