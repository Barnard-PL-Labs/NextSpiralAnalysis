import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Next.js compiles JSX with the automatic runtime, so components never import
  // React. esbuild defaults to the classic runtime, which emits
  // React.createElement and fails with "React is not defined".
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.js",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
