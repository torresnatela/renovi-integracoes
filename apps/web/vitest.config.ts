import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    name: "web",
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    passWithNoTests: true,
  },
});
