import { default as defaultConfig } from '@epic-web/config/eslint'

/** @type {import("eslint").Linter.Config} */
export default [
	...defaultConfig,
	// add custom config objects here:
	{ ignores: ['.react-router/**', '.ignored/**'] }, // TODO: ignore gitignored files by default
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
