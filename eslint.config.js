// Root ESLint config for monorepo
import storybook from 'eslint-plugin-storybook';
import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		ignores: [
			'**/node_modules/**',
			'**/.svelte-kit/**',
			'**/build/**',
			'**/dist/**',
			'**/storybook-static/**'
		]
	},
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			'no-undef': 'off',
			'svelte/prefer-svelte-reactivity': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					args: 'all',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			]
		}
	},
	{
		files: [
			'packages/app/**/*.svelte',
			'packages/app/**/*.svelte.ts',
			'packages/app/**/*.svelte.js'
		],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig: './packages/app/svelte.config.js'
			}
		}
	},
	{
		files: [
			'packages/studio/**/*.svelte',
			'packages/studio/**/*.svelte.ts',
			'packages/studio/**/*.svelte.js'
		],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig: './packages/studio/svelte.config.js'
			}
		}
	},
	{
		files: [
			'packages/svgeditor/**/*.svelte',
			'packages/svgeditor/**/*.svelte.ts',
			'packages/svgeditor/**/*.svelte.js'
		],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig: './packages/svgeditor/svelte.config.js'
			}
		},
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	storybook.configs['flat/recommended']
);
