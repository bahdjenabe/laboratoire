import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Pattern volontaire « fetch au montage + état de chargement » : les hooks
      // de données (useDashboard, useNotifications, pages de liste) appellent une
      // fonction de chargement dans un useEffect, qui passe loading à true puis
      // remplit l'état après l'await. C'est correct et intentionnel ; on garde la
      // règle en avertissement pour rester informé sans bloquer le build/CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
