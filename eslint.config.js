// ESLint flat config for Node 18, browser, and Jest
import js from "@eslint/js";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "data/**", "**/*.min.js"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        fetch: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
      "no-undef": "off",
      "no-case-declarations": "off",
      "no-dupe-class-members": "off",
    },
  },
];
