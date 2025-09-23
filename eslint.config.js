import { default as defaultConfig } from '@epic-web/config/eslint'

/** @type {import("eslint").Linter.Config} */
export default [
	...defaultConfig,
	// TODO: ignore gitignored files by default
	{ ignores: ['.react-router/**', '.ignored/**'] },
	// add custom config objects here:
	{
		files: ['**/tests/**/*.ts'],
		ignores: [
			'/node_modules/**',
			'/build/**',
			'/public/build/**',
			'/playwright-report/**',
			'/server-build/**',
		],
		rules: {
			'react-hooks/rules-of-hooks': 'off',
		},
	},
]
