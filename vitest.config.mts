import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests unitaires de la logique pure (lib/). Pas de DOM nécessaire.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
