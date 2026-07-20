import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Run each test file in its own worker for proper isolation
    pool: "forks",
    include: ["src/**/*.test.ts"],
  },
});
