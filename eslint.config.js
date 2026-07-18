// @ts-check
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint flat config for the AstroCalc monorepo (apps/* and
 * packages/calc-engine all pick this up as-is — no per-package config).
 * TypeScript strict-mode rules are enabled via typescript-eslint's `strict`
 * + `stylistic` rule sets; `eslint-config-prettier` turns off stylistic
 * rules that would conflict with Prettier, which owns formatting.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/.next/**',
      '.automation/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // The existing codebase (calc-engine's astronomical math especially)
      // uses `!` deliberately and consistently after an explicit bounds/
      // existence check (e.g. array access just after a `.length` check) —
      // banning it outright would force touching dozens of already-correct,
      // already-tested files for a style preference with no safety benefit.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Matches the codebase's existing underscore-prefix convention for
      // intentionally-unused parameters (e.g. Express error middleware's
      // required-but-unused `next`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `promise.catch(() => {})` to deliberately swallow an expected
      // rejection is a standard, readable test pattern.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
    },
  },
  {
    // Metro's config file is loaded by Metro itself (not bundled/transpiled),
    // so it must stay CommonJS — `require()` isn't a style choice here.
    files: ['**/metro.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // apps/mobile is the only React (Expo/React Native) code in the
    // monorepo. Only the two long-standing, universally-applicable rules —
    // not the full v7 "recommended" set, which bundles newer React-Compiler-
    // oriented rules (e.g. set-state-in-effect) that flag the ordinary
    // fetch-on-mount pattern this codebase already uses correctly.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  eslintConfigPrettier,
);
