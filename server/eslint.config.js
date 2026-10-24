import js from '@eslint/js';
import globals from 'globals';

// Mismo ESLint 9 que el cliente (fijado en 9.x por el mismo motivo, ver
// CLAUDE.md). Solo las reglas recomendadas: lo que se busca es atrapar
// variables sin usar, imports rotos y errores tontos, no imponer estilo.
export default [
  { ignores: ['node_modules', 'panel-pruebas'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      // `next` en los manejadores de error de Express tiene que estar aunque
      // no se use (Express cuenta los argumentos), y un _ marca lo ignorado.
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^(_|next$)', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
];
