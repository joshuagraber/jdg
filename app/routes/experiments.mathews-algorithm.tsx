import {
	MathewsAlgorithmWorkbench,
	type MathewsSessionData,
	restoreSessionData,
} from '@joshuagraber/digital-poetics'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useFetcher } from 'react-router'
import '@joshuagraber/digital-poetics/styles'
import '#app/styles/digital-poetics.css'
import { ClientOnly } from 'remix-utils/client-only'
import { Button } from '#app/components/ui/button.tsx'
import { MATHEWS_ALGORITHM_LINK_PREVIEW } from '#app/content/experiments'
import { getHints } from '#app/utils/client-hints.tsx'
import { type LinkPreviewHandle } from '#app/utils/link-preview'
import { type Route } from './+types'

const PDF_PATH = '/pdf/mathews_algorithm.pdf'
const SESSION_STORAGE_KEY = 'mathews-algorithm-session'
const SESSION_ID_STORAGE_KEY = 'mathews-algorithm-session-id'
const MATHEWS_IMAGE_ALT = MATHEWS_ALGORITHM_LINK_PREVIEW.imageAlt

function resolveMathewsImage(theme?: string | null) {
	return theme === 'dark'
		? MATHEWS_ALGORITHM_LINK_PREVIEW.images.dark
		: MATHEWS_ALGORITHM_LINK_PREVIEW.images.light
}

const MATHEWS_LINK_PREVIEW_CONTENT = JSON.stringify({
	url: MATHEWS_ALGORITHM_LINK_PREVIEW.url,
	title: MATHEWS_ALGORITHM_LINK_PREVIEW.title,
	description: MATHEWS_ALGORITHM_LINK_PREVIEW.description,
	image: MATHEWS_ALGORITHM_LINK_PREVIEW.images.light,
	imageLight: MATHEWS_ALGORITHM_LINK_PREVIEW.images.light,
	imageDark: MATHEWS_ALGORITHM_LINK_PREVIEW.images.dark,
	imageAlt: MATHEWS_IMAGE_ALT,
})

function resolveMathewsSession(): MathewsSessionData | undefined {
	if (typeof window === 'undefined') return undefined

	try {
		const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
		if (!raw) return undefined
		return (
			restoreSessionData(JSON.parse(raw) as MathewsSessionData) ?? undefined
		)
	} catch (error) {
		console.error('Unable to restore Mathews algorithm session', error)
		return undefined
	}
}

function createSessionId() {
	if (
		typeof window !== 'undefined' &&
		typeof window.crypto?.randomUUID === 'function'
	) {
		return window.crypto.randomUUID()
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function resolveMathewsSessionId() {
	if (typeof window === 'undefined') return null

	try {
		const existing = window.localStorage.getItem(SESSION_ID_STORAGE_KEY)
		if (existing) return existing
		const next = createSessionId()
		window.localStorage.setItem(SESSION_ID_STORAGE_KEY, next)
		return next
	} catch (error) {
		console.error('Unable to resolve Mathews algorithm session id', error)
		return createSessionId()
	}
}

export const handle: LinkPreviewHandle = {
	async linkPreview({ request }) {
		const hints = getHints(request)
		const hostname = new URL(request.url).hostname
		const image = resolveMathewsImage(hints.theme)
		return {
			url: MATHEWS_ALGORITHM_LINK_PREVIEW.url,
			title: MATHEWS_ALGORITHM_LINK_PREVIEW.title,
			description: MATHEWS_ALGORITHM_LINK_PREVIEW.description,
			image,
			imageLight: MATHEWS_ALGORITHM_LINK_PREVIEW.images.light,
			imageDark: MATHEWS_ALGORITHM_LINK_PREVIEW.images.dark,
			imageAlt: MATHEWS_IMAGE_ALT,
			domain: hostname,
		}
	},
}

export const meta: Route.MetaFunction = ({ matches }) => {
	const rootMatch = matches.find((match) => match?.id === 'root')
	const rootData = rootMatch?.data as
		| {
				requestInfo?: {
					hints?: { theme?: string | null }
					ogURL?: URL | string
				}
		  }
		| undefined
	const theme = rootData?.requestInfo?.hints?.theme ?? null
	const ogURL = rootData?.requestInfo?.ogURL
	const previewImage = resolveMathewsImage(theme)
	const absolutePreviewImage =
		typeof ogURL === 'string' || ogURL instanceof URL
			? new URL(previewImage, ogURL).toString()
			: previewImage
	const title = `${MATHEWS_ALGORITHM_LINK_PREVIEW.title} | JDG`

	return [
		{ title },
		{
			name: 'description',
			property: 'description',
			content: MATHEWS_ALGORITHM_LINK_PREVIEW.description,
		},
		{ property: 'og:title', name: 'og:title', content: title },
		{
			property: 'og:description',
			name: 'og:description',
			content: MATHEWS_ALGORITHM_LINK_PREVIEW.description,
		},
		{ property: 'og:type', name: 'og:type', content: 'article' },
		{ property: 'og:image', name: 'og:image', content: absolutePreviewImage },
		{
			property: 'og:image:alt',
			name: 'og:image:alt',
			content: MATHEWS_IMAGE_ALT,
		},
		{
			property: 'twitter:card',
			name: 'twitter:card',
			content: 'summary_large_image',
		},
		{ name: 'twitter:title', property: 'twitter:title', content: title },
		{
			name: 'twitter:description',
			property: 'twitter:description',
			content: MATHEWS_ALGORITHM_LINK_PREVIEW.description,
		},
		{
			name: 'twitter:image',
			property: 'twitter:image',
			content: absolutePreviewImage,
		},
		{
			name: 'twitter:image:alt',
			property: 'twitter:image:alt',
			content: MATHEWS_IMAGE_ALT,
		},
		{ name: 'link-preview', content: MATHEWS_LINK_PREVIEW_CONTENT },
	]
}

export default function MathewsAlgorithmExperimentRoute() {
	return (
		<ClientOnly fallback={<MathewsAlgorithmLoading />}>
			{() => <MathewsAlgorithmInteractive />}
		</ClientOnly>
	)
}

function MathewsAlgorithmInteractive() {
	const initialSession = useMemo(resolveMathewsSession, [])
	const sessionId = useMemo(resolveMathewsSessionId, [])
	const hasSeenInitialSession = useRef(false)
	const lastSubmittedSession = useRef<string | null>(null)
	const persistenceFetcher = useFetcher<{
		ok: boolean
		error?: string
	}>()

	useEffect(() => {
		if (persistenceFetcher.data?.ok === false) {
			console.error(
				'Mathews algorithm persistence request failed',
				persistenceFetcher.data.error,
			)
		}
	}, [persistenceFetcher.data])

	const handleSessionChange = useCallback(
		(session: MathewsSessionData) => {
			try {
				window.localStorage.setItem(
					SESSION_STORAGE_KEY,
					JSON.stringify(session),
				)
			} catch (error) {
				console.error('Unable to save Mathews algorithm session', error)
			}

			if (!hasSeenInitialSession.current) {
				hasSeenInitialSession.current = true
				return
			}

			if (!sessionId) return

			const serializedSession = JSON.stringify(session)
			if (serializedSession === lastSubmittedSession.current) return
			lastSubmittedSession.current = serializedSession

			const payload = new FormData()
			payload.append('id', sessionId)
			payload.append('size', session.size.toString())
			payload.append('table', JSON.stringify(session.table))
			payload.append('shiftPasses', (session.shiftPasses ?? 1).toString())
			payload.append('updatedAt', new Date().toISOString())

			void persistenceFetcher.submit(payload, {
				method: 'POST',
				action: '/resources/experiments/mathews-algorithm',
			})
		},
		[persistenceFetcher, sessionId],
	)

	return (
		<main className="container pb-24 pt-10">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
				<header className="flex flex-col gap-5">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight text-foreground">
							Mathews&apos; Algorithm
						</h1>
						<div className="mt-3 space-y-4 text-base text-muted-foreground">
							<p>
								Build a table of equivalent textual elements, then generate new
								sets by shifting left and reading down, and shifting right and
								reading up.
							</p>
							<p>
								Based on{' '}
								<Link
									to="https://en.wikipedia.org/wiki/Harry_Mathews"
									rel="noopener noreferrer"
									target="_blank"
								>
									Harry Mathews&apos;s
								</Link>{' '}
								algorithm, developed during Mathews&apos;s association with the{' '}
								<Link
									to="https://en.wikipedia.org/wiki/Oulipo"
									rel="noopener noreferrer"
									target="_blank"
								>
									Oulipo writers.
								</Link>
							</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Button asChild variant="outline">
							<Link
								to={PDF_PATH}
								target="_blank"
								rel="noopener noreferrer"
								className="no-underline"
							>
								Open a PDF of Mathews&apos;s essay explaining the algorithm
							</Link>
						</Button>
					</div>
				</header>

				<section
					aria-label="Instructions"
					className="rounded-lg border border-border bg-card/50 p-5"
				>
					<h2 className="text-lg font-semibold tracking-tight">Instructions</h2>
					<ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
						<li>
							Use each row as a set, with each cell holding an element
							equivalent to the others in its column.
						</li>
						<li>
							Adjust table size or shift passes, or start from the included
							sample defaults.
						</li>
						<li>
							Read the generated sets from the two output panels and revise the
							table until the combinations carry.
						</li>
					</ol>
				</section>

				<MathewsAlgorithmWorkbench
					initialSession={initialSession}
					initialSize={4}
					onSessionChange={handleSessionChange}
					className="w-full"
				/>
			</div>
		</main>
	)
}

function MathewsAlgorithmLoading() {
	return (
		<div className="container pb-24 pt-10">
			<div className="rounded-3xl border border-dashed border-border bg-muted/50 p-8 text-muted-foreground">
				Loading Mathews&apos; Algorithm…
			</div>
		</div>
	)
}
