import { useForm, getFormProps } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { redirect, useFetcher, useFetchers } from '@remix-run/react'
import { useEffect } from 'react'
import { ServerOnly } from 'remix-utils/server-only'
import { z } from 'zod'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { useHints, useOptionalHints } from '#app/utils/client-hints.tsx'
import {
	useOptionalRequestInfo,
	useRequestInfo,
} from '#app/utils/request-info.ts'
import { type Theme, setTheme } from '#app/utils/theme.server.ts'

const ThemeFormSchema = z.object({
	theme: z.enum(['system', 'light', 'dark']),
	// this is useful for progressive enhancement
	redirectTo: z.string().optional(),
})

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: ThemeFormSchema,
	})

	invariantResponse(submission.status === 'success', 'Invalid theme received')

	const { theme, redirectTo } = submission.value

	const responseInit = {
		headers: { 'set-cookie': setTheme(theme) },
	}
	if (redirectTo) {
		return redirect(redirectTo, responseInit)
	} else {
		return json({ result: submission.reply() }, responseInit)
	}
}

export function ThemeSwitch({
	userPreference,
}: {
	userPreference?: Theme | null
}) {
	const fetcher = useFetcher<typeof action>()
	const requestInfo = useRequestInfo()
	const hints = useHints()

	const [form] = useForm({
		id: 'theme-switch',
		lastResult: fetcher.data?.result,
	})

	const optimisticMode = useOptimisticThemeMode()
	const mode = optimisticMode ?? userPreference ?? 'system'

	// Add system theme change listener
	useEffect(() => {
		if (mode === 'system') {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

			const handleChange = (e: MediaQueryListEvent) => {
				console.debug('MediaQuery changed:', e.matches)
				document.documentElement.classList.toggle('dark', e.matches)
				document.documentElement.classList.toggle('light', !e.matches)
			}

			mediaQuery.addEventListener('change', handleChange)

			// Set initial theme
			handleChange({ matches: mediaQuery.matches } as MediaQueryListEvent)

			return () => mediaQuery.removeEventListener('change', handleChange)
		}
	}, [mode])

	const modeLabel = {
		light: (
			<Icon name="sun">
				<span className="sr-only">Light</span>
			</Icon>
		),
		dark: (
			<Icon name="moon">
				<span className="sr-only">Dark</span>
			</Icon>
		),
		system: (
			<Icon name="laptop">
				<span className="sr-only">System</span>
			</Icon>
		),
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center">
				{modeLabel[mode]}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="top">
				{' '}
				{/* Opens upward */}
				<fetcher.Form
					method="POST"
					{...getFormProps(form)}
					action="/resources/theme-switch"
				>
					<ServerOnly>
						{() => (
							<input type="hidden" name="redirectTo" value={requestInfo.path} />
						)}
					</ServerOnly>

					<DropdownMenuItem asChild>
						<button
							type="submit"
							name="theme"
							value="system"
							className={`flex w-full items-center gap-2 ${
								mode === 'system' ? 'text-primary' : ''
							}`}
						>
							<Icon name="laptop" />
							System
						</button>
					</DropdownMenuItem>

					<DropdownMenuItem asChild>
						<button
							type="submit"
							name="theme"
							value="light"
							className={`flex w-full items-center gap-2 ${
								mode === 'light' ? 'text-primary' : ''
							}`}
						>
							<Icon name="sun" />
							Light
						</button>
					</DropdownMenuItem>

					<DropdownMenuItem asChild>
						<button
							type="submit"
							name="theme"
							value="dark"
							className={`flex w-full items-center gap-2 ${
								mode === 'dark' ? 'text-primary' : ''
							}`}
						>
							<Icon name="moon" />
							Dark
						</button>
					</DropdownMenuItem>
				</fetcher.Form>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/**
 * If the user's changing their theme mode preference, this will return the
 * value it's being changed to.
 */
export function useOptimisticThemeMode() {
	const fetchers = useFetchers()
	const themeFetcher = fetchers.find(
		(f) => f.formAction === '/resources/theme-switch',
	)

	if (themeFetcher && themeFetcher.formData) {
		const submission = parseWithZod(themeFetcher.formData, {
			schema: ThemeFormSchema,
		})

		if (submission.status === 'success') {
			return submission.value.theme
		}
	}
}

/**
 * @returns the user's theme preference, or the client hint theme if the user
 * has not set a preference.
 */
export function useTheme() {
	const hints = useHints()
	const requestInfo = useRequestInfo()
	const optimisticMode = useOptimisticThemeMode()
	if (optimisticMode) {
		return optimisticMode === 'system' ? hints.theme : optimisticMode
	}
	return requestInfo.userPrefs.theme ?? hints.theme
}

export function useOptionalTheme() {
	const optionalHints = useOptionalHints()
	const optionalRequestInfo = useOptionalRequestInfo()
	const optimisticMode = useOptimisticThemeMode()
	if (optimisticMode) {
		return optimisticMode === 'system' ? optionalHints?.theme : optimisticMode
	}
	return optionalRequestInfo?.userPrefs.theme ?? optionalHints?.theme
}
