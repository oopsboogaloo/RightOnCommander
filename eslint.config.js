import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // The sim/ import-boundary rule: the pure deterministic core must not reach
  // into the DOM/Canvas/Audio shell, and must not use Math.random. [design §2, ROC-TEST-1]
  {
    files: ['src/sim/**/*.ts'],
    languageOptions: {
      globals: {}, // no browser globals available inside sim/
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'sim/ must stay free of the DOM.' },
        { name: 'window', message: 'sim/ must stay free of the DOM.' },
        { name: 'navigator', message: 'sim/ must stay free of the DOM.' },
        { name: 'localStorage', message: 'Use the injected Storage interface, not localStorage, in sim/.' },
        { name: 'requestAnimationFrame', message: 'sim/ advances via fixed steps, not rAF.' },
        { name: 'performance', message: 'sim/ must not read the wall clock.' },
        { name: 'AudioContext', message: 'sim/ must stay free of Web Audio.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Banned in sim/. Use world.rng for all randomness.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render/**', '**/audio/**', '**/input/**', '**/platform/**'],
              message: 'sim/ is pure: it must not import shell layers (render/audio/input/platform).',
            },
          ],
        },
      ],
    },
  },
);
