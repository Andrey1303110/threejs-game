import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,

    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },

        rules: {
            // 🔥 ВАЖНОЕ
            'no-unused-vars': 'warn',
            'no-undef': 'error',

            // 🔥 let vs const
            'prefer-const': 'error',

            // 🔥 стиль
            'no-var': 'error',

            // 🔥 безопасность
            'no-empty': 'warn',
            'no-fallthrough': 'error',

            // 🔥 отладка
            'no-console': 'off',

            // 🔥 аккуратность
            'eqeqeq': 'error',
        }
    }
];