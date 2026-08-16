import { runSync } from '@mdx-js/mdx'
import { useMemo } from 'react'
import * as runtime from 'react/jsx-runtime'

export function useMDXComponent(code: string) {
	return useMemo(() => runSync(code, runtime).default, [code])
}
