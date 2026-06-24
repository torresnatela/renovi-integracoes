import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "db",
    environment: "node",
    include: ["test/**/*.test.ts"],
    // PGlite spins up a fresh in-process Postgres per file; keep them isolated.
    fileParallelism: false,
    passWithNoTests: true,
  },
});
