import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.rf_backups/**',
      'Scanner/**',
      'app/frontend-modern/dist/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['backend/va_scanner/**/*.{js,mjs}'],
    rules: {
      // Migrated scanner rules rely on dense regex catalogs; keep these as warnings/ignored for now.
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['backend/tests/**/*.{js,mjs}'],
    rules: {
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['app/frontend-modern/src/**/*.{js,jsx}'],
    ignores: [
      'app/frontend-modern/src/tests/**/*.{js,jsx}',
      'app/frontend-modern/src/**/__tests__/**/*.{js,jsx}',
      'app/frontend-modern/src/system/placeholders/**/*.{js,jsx}'
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='placeholder'][value.type='Literal']",
          message: 'Use placeholders registry values instead of hardcoded placeholder strings.'
        },
        {
          selector: "JSXAttribute[name.name='placeholder'] > JSXExpressionContainer > Literal",
          message: 'Use placeholders registry values instead of hardcoded placeholder strings.'
        },
        {
          selector: "JSXAttribute[name.name='placeholder'] > JSXExpressionContainer > TemplateLiteral[expressions.length=0]",
          message: 'Use placeholders registry values instead of hardcoded placeholder strings.'
        }
      ]
    }
  },
  {
    files: ['**/*.test.{js,mjs,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    }
  },
  {
    files: ['src/**/*.{js,jsx}', 'app/frontend-modern/src/**/*.{js,jsx}', 'backend/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      ...reactHooks.configs.recommended.rules
    }
  },
  {
    files: ['backend/va_scanner/**/*.{js,mjs}', 'backend/tests/**/*.{js,mjs}'],
    rules: {
      'no-unused-vars': 'off'
    }
  }
];
