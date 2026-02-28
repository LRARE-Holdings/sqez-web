import js from "@eslint/js";
import tseslint from "typescript-eslint";

const config = [
  // Ignore built output if present
  {
    ignores: ["lib/**", "dist/**", "node_modules/**"],
  },

  js.configs.recommended,

  // TypeScript recommended rules (no Next.js rules)
  ...tseslint.configs.recommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
    },
    rules: {
      // Keep it practical for functions
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
