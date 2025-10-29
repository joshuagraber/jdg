import {
	WheelPoem,
	WheelPoemControls,
	WheelPoemStats,
	WheelPoemTextInput,
	WheelPoemTextPreview,
	useWheelState,
} from '@joshuagraber/digital-poetics'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFetcher } from 'react-router'
import '@joshuagraber/digital-poetics/styles'
import '#app/styles/digital-poetics.css'
import { ClientOnly } from 'remix-utils/client-only'
import { WHEEL_POEM_LINK_PREVIEW } from '#app/content/experiments'
import { getHints } from '#app/utils/client-hints.tsx'
import { type LinkPreviewHandle } from '#app/utils/link-preview'
import { type Route } from './+types'

const WHEEL_POEM_IMAGE_ALT = WHEEL_POEM_LINK_PREVIEW.imageAlt

function resolveWheelPoemImage(theme?: string | null) {
	return theme === 'dark'
		? WHEEL_POEM_LINK_PREVIEW.images.dark
		: WHEEL_POEM_LINK_PREVIEW.images.light
}

const WHEEL_POEM_LINK_PREVIEW_CONTENT = JSON.stringify({
	url: WHEEL_POEM_LINK_PREVIEW.url,
	title: WHEEL_POEM_LINK_PREVIEW.title,
	description: WHEEL_POEM_LINK_PREVIEW.description,
	image: WHEEL_POEM_LINK_PREVIEW.images.light,
	imageLight: WHEEL_POEM_LINK_PREVIEW.images.light,
	imageDark: WHEEL_POEM_LINK_PREVIEW.images.dark,
	imageAlt: WHEEL_POEM_IMAGE_ALT,
})

const SESSION_STORAGE_KEY = 'wheel-poem-sessions'
const PENDING_SESSION_STORAGE_KEY = 'wheel-poem-pending-session-id'
const MAX_SAVED_SESSIONS = 8

interface StoredSession {
	id: string
	text: string
	rotations: number[]
	wheelSize: number | null
	updatedAt: string
}

const sessionDateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short',
})

function hashText(text: string) {
	let hash = 0
	for (let index = 0; index < text.length; index++) {
		hash = (hash << 5) - hash + text.charCodeAt(index)
		hash |= 0
	}
	return `${Math.abs(hash).toString(36)}-${text.length.toString(36)}`
}

function truncateSessionText(text: string, maxLength = 28) {
	const normalized = text.trim().replace(/\s+/g, ' ')
	if (!normalized) return '(empty)'
	return normalized.length > maxLength
		? `${normalized.slice(0, maxLength - 1)}…`
		: normalized
}

function formatSessionTimestamp(timestamp: string) {
	try {
		return sessionDateFormatter.format(new Date(timestamp))
	} catch (error) {
		console.error('Failed to format wheel session timestamp', error)
		return timestamp
	}
}

function normalizeRotations(rotations: unknown): number[] {
	if (!Array.isArray(rotations)) return Array(10).fill(0)
	const normalized = rotations
		.slice(0, 10)
		.map((value) => (Number.isFinite(value as number) ? Number(value) : 0))
	while (normalized.length < 10) normalized.push(0)
	return normalized.map((value) => ((value % 360) + 360) % 360)
}

function areRotationsEqual(a: number[], b: number[]) {
	if (a.length !== b.length) return false
	for (let index = 0; index < a.length; index++) {
		if (Math.abs((a[index] ?? 0) - (b[index] ?? 0)) > 0.0001) {
			return false
		}
	}
	return true
}

function coerceSession(entry: unknown): StoredSession | null {
	if (!entry || typeof entry !== 'object') return null
	const candidate = entry as Partial<StoredSession> & { rotations?: unknown }
	if (
		typeof candidate.id !== 'string' ||
		typeof candidate.text !== 'string' ||
		typeof candidate.updatedAt !== 'string'
	) {
		return null
	}

	return {
		id: candidate.id,
		text: candidate.text,
		rotations: normalizeRotations(candidate.rotations),
		wheelSize:
			typeof candidate.wheelSize === 'number' &&
			Number.isFinite(candidate.wheelSize)
				? candidate.wheelSize
				: null,
		updatedAt: candidate.updatedAt,
	}
}

type SavedSessionsListProps = {
	sessions: StoredSession[]
	onResume: (session: StoredSession) => void
	disabled?: boolean
}

function SavedSessionsList({
	sessions,
	onResume,
	disabled,
}: SavedSessionsListProps) {
	if (sessions.length === 0) {
		return null
	}

	// TODO: why do we need to use custom `rounded` here? Why isn't `rounded-xl` enough? Effing Tailwind 🙄
	return (
		<aside className="flex h-max flex-col gap-3 rounded-[.5rem] border border-border bg-card/50 p-4 shadow-sm">
			<h2 className="text-base font-semibold text-foreground">
				Continue where you left off?
			</h2>
			<div className="flex flex-col gap-2">
				{sessions.slice(0, 5).map((session) => (
					<button
						key={session.id}
						type="button"
						onClick={() => onResume(session)}
						disabled={disabled}
						className="group w-full rounded-xl border border-border/70 bg-background px-4 py-3 text-left transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<span className="block text-sm font-medium text-foreground group-hover:text-foreground">
							{truncateSessionText(session.text)}
						</span>
						<span className="block text-xs text-muted-foreground">
							{formatSessionTimestamp(session.updatedAt)}
						</span>
					</button>
				))}
			</div>
		</aside>
	)
}

export const handle: LinkPreviewHandle = {
	async linkPreview({ request }) {
		const hints = getHints(request)
		const hostname = new URL(request.url).hostname
		const image = resolveWheelPoemImage(hints.theme)
		return {
			url: WHEEL_POEM_LINK_PREVIEW.url,
			title: WHEEL_POEM_LINK_PREVIEW.title,
			description: WHEEL_POEM_LINK_PREVIEW.description,
			image,
			imageLight: WHEEL_POEM_LINK_PREVIEW.images.light,
			imageDark: WHEEL_POEM_LINK_PREVIEW.images.dark,
			imageAlt: WHEEL_POEM_IMAGE_ALT,
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
	const previewImage = resolveWheelPoemImage(theme)
	const absolutePreviewImage =
		typeof ogURL === 'string' || ogURL instanceof URL
			? new URL(previewImage, ogURL).toString()
			: previewImage

	return [
		{
			title: `${WHEEL_POEM_LINK_PREVIEW.title} | JDG`,
		},
		{
			name: 'description',
			property: 'description',
			content: WHEEL_POEM_LINK_PREVIEW.description,
		},
		{
			property: 'og:title',
			name: 'og:title',
			content: `${WHEEL_POEM_LINK_PREVIEW.title} | JDG`,
		},
		{
			property: 'og:description',
			name: 'og:description',
			content: WHEEL_POEM_LINK_PREVIEW.description,
		},
		{ property: 'og:type', name: 'og:type', content: 'article' },
		{
			property: 'og:image',
			name: 'og:image',
			content: absolutePreviewImage,
		},
		{
			property: 'og:image:alt',
			name: 'og:image:alt',
			content: WHEEL_POEM_IMAGE_ALT,
		},
		{
			property: 'twitter:card',
			name: 'twitter:card',
			content: 'summary_large_image',
		},
		{
			name: 'twitter:title',
			property: 'twitter:title',
			content: `${WHEEL_POEM_LINK_PREVIEW.title} | JDG`,
		},
		{
			name: 'twitter:description',
			property: 'twitter:description',
			content: WHEEL_POEM_LINK_PREVIEW.description,
		},
		{
			name: 'twitter:image',
			property: 'twitter:image',
			content: absolutePreviewImage,
		},
		{
			name: 'twitter:image:alt',
			property: 'twitter:image:alt',
			content: WHEEL_POEM_IMAGE_ALT,
		},
		{
			name: 'link-preview',
			content: WHEEL_POEM_LINK_PREVIEW_CONTENT,
		},
	]
}

export default function WheelPoemExperimentRoute() {
	return (
		<ClientOnly fallback={<WheelPoemLoading />}>
			{() => <WheelPoemInteractive />}
		</ClientOnly>
	)
}

function WheelPoemInteractive() {
	const [hasProcessed, setHasProcessed] = useState(false)
	const [savedSessions, setSavedSessions] = useState<StoredSession[]>([])
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
	const [lastSubmittedText, setLastSubmittedText] = useState<string | null>(
		null,
	)
	const [lastWheelSize, setLastWheelSize] = useState<number | null>(null)
	const [isRestoring, setIsRestoring] = useState(false)
	const wheelState = useWheelState()
	const sessionPersistenceFetcher = useFetcher<{ ok: boolean; error?: string }>()
	const [pendingResumeId, setPendingResumeId] = useState<string | null>(null)

	const layoutClasses = useMemo(() => {
		return [
			'w-full lg:grid-rows-[auto,auto]',
			savedSessions.length > 0
				? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'
				: '',
		]
			.filter(Boolean)
			.join(' ')
	}, [savedSessions.length])

	useEffect(() => {
		if (typeof window === 'undefined') return
		try {
			const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
			if (!raw) return
			const parsed = JSON.parse(raw) as unknown
			if (!Array.isArray(parsed)) return
			const sanitized = parsed
				.map(coerceSession)
				.filter((session): session is StoredSession => session !== null)
				.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
			setSavedSessions(sanitized.slice(0, MAX_SAVED_SESSIONS))
			const pendingId = window.localStorage.getItem(
				PENDING_SESSION_STORAGE_KEY,
			)
			if (pendingId) {
				setPendingResumeId(pendingId)
			}
		} catch (error) {
			console.error('Unable to load saved wheel poem sessions', error)
		}
	}, [])

	useEffect(() => {
		if (!wheelState.textDistribution) setHasProcessed(false)
	}, [wheelState.textDistribution])

	useEffect(() => {
		if (sessionPersistenceFetcher.data?.ok === false) {
			console.error(
				'Wheel poem persistence request failed',
				sessionPersistenceFetcher.data.error,
			)
		}
	}, [sessionPersistenceFetcher.data])

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (!hasProcessed) return

		let frame = 0

		const measure = () => {
			const element = document.querySelector('[data-wheel-container]')
			if (element instanceof HTMLElement) {
				const rect = element.getBoundingClientRect()
				const size = Math.min(rect.width, rect.height) / 2
				setLastWheelSize((previous) => {
					if (!Number.isFinite(size)) return previous
					if (previous === null) return size
					return Math.abs(previous - size) > 0.5 ? size : previous
				})
			}
		}

		const scheduleMeasure = () => {
			if (frame) window.cancelAnimationFrame(frame)
			frame = window.requestAnimationFrame(measure)
		}

		scheduleMeasure()
		window.addEventListener('resize', scheduleMeasure)

		return () => {
			if (frame) window.cancelAnimationFrame(frame)
			window.removeEventListener('resize', scheduleMeasure)
		}
	}, [hasProcessed, wheelState.textDistribution])

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (!activeSessionId || !lastSubmittedText || !wheelState.textDistribution)
			return
		if (wheelState.isProcessing) return

		const normalizedRotations = normalizeRotations(wheelState.rotations)
		const wheelSize = lastWheelSize ?? null
		const timestamp = new Date().toISOString()

		setSavedSessions((previous) => {
			const existingIndex = previous.findIndex(
				(session) => session.id === activeSessionId,
			)
			const existing = existingIndex >= 0 ? previous[existingIndex] : null
			if (
				existing &&
				existing.text === lastSubmittedText &&
				(existing.wheelSize ?? null) === wheelSize &&
				areRotationsEqual(existing.rotations, normalizedRotations)
			) {
				return previous
			}

			const updated: StoredSession = {
				id: activeSessionId,
				text: lastSubmittedText,
				rotations: normalizedRotations,
				wheelSize,
				updatedAt: timestamp,
			}

			const next = [...previous]
			if (existingIndex >= 0) {
				next[existingIndex] = updated
			} else {
				next.unshift(updated)
			}

			next.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))

			const trimmed = next.slice(0, MAX_SAVED_SESSIONS)
			window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(trimmed))
			const payload = new FormData()
			payload.append('id', updated.id)
			payload.append('text', updated.text)
			payload.append('rotations', JSON.stringify(updated.rotations))
			payload.append(
				'wheelSize',
				updated.wheelSize === null ? '' : updated.wheelSize.toString(),
			)
			payload.append('updatedAt', updated.updatedAt)
			void sessionPersistenceFetcher.submit(payload, {
				method: 'POST',
				action: '/resources/experiments/wheel-poem',
			})

			return trimmed
		})
	}, [
		activeSessionId,
		lastSubmittedText,
		lastWheelSize,
		sessionPersistenceFetcher,
		wheelState.isProcessing,
		wheelState.rotations,
		wheelState.textDistribution,
	])

	const handleProcessText = useCallback(
		async (text: string) => {
			const id = hashText(text)
			setActiveSessionId(id)
			setLastSubmittedText(text)
			setLastWheelSize(null)
			await wheelState.processText(text)
		},
		[wheelState],
	)

	const handleResumeSession = useCallback(
		async (session: StoredSession) => {
			if (isRestoring || wheelState.isProcessing) return
			setIsRestoring(true)
			setActiveSessionId(session.id)
			setLastSubmittedText(session.text)
			setLastWheelSize(session.wheelSize)
			setHasProcessed(true)
			try {
				await wheelState.processText(
					session.text,
					session.wheelSize ?? undefined,
				)
				wheelState.setRotations(session.rotations)
			} catch (error) {
				console.error('Unable to restore wheel poem session', error)
				setHasProcessed(false)
			} finally {
				setIsRestoring(false)
			}
		},
		[isRestoring, wheelState],
	)

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (hasProcessed) return
		if (wheelState.isProcessing || isRestoring) return
		if (!pendingResumeId) return
		if (savedSessions.length === 0) return

	const matching = savedSessions.find(
		(session) => session.id === pendingResumeId,
	)

	if (!matching) {
		window.localStorage.removeItem(PENDING_SESSION_STORAGE_KEY)
		setPendingResumeId(null)
		return
	}

	window.localStorage.removeItem(PENDING_SESSION_STORAGE_KEY)
	setPendingResumeId(null)
	void handleResumeSession(matching)
	}, [
		handleResumeSession,
		hasProcessed,
		isRestoring,
		pendingResumeId,
		savedSessions,
		wheelState.isProcessing,
	])

	const handleRequestNewText = useCallback(() => {
		setHasProcessed(false)
		setActiveSessionId(null)
		setLastSubmittedText(null)
		setLastWheelSize(null)
	}, [])

	return (
		<div className="container">
			{!hasProcessed && (
				<div className={layoutClasses}>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground lg:col-span-2">
						Wheel Poem
					</h1>
					<WheelPoemTextInput
						{...wheelState}
						processText={handleProcessText}
						className="w-full"
						onTextProcessed={() => setHasProcessed(true)}
					/>
					<div className="lg:pt-7">
						<SavedSessionsList
							sessions={savedSessions}
							onResume={handleResumeSession}
							disabled={wheelState.isProcessing || isRestoring}
						/>
					</div>
				</div>
			)}
			{hasProcessed && (
				<div className="mx-auto flex w-full flex-col gap-8">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<h1 className="self-start text-2xl font-semibold tracking-tight text-foreground">
							Wheel Poem
						</h1>
						<WheelPoemControls
							{...wheelState}
							onRequestNewText={handleRequestNewText}
							className="w-full lg:max-w-[26rem]"
						/>
					</div>
					<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
						<div className="mx-auto w-full">
							<WheelPoem {...wheelState} className="mx-auto w-full" />
						</div>
						<WheelPoemTextPreview
							className="w-full"
							text={wheelState.currentPoemText}
							isVisible={!!wheelState.textDistribution}
						/>
					</div>
					<WheelPoemStats
						wheelStats={wheelState.wheelStats}
						className="w-full"
					/>
				</div>
			)}
		</div>
	)
}

function WheelPoemLoading() {
	return (
		<div className="mt-10 rounded-3xl border border-dashed border-border bg-muted/50 p-8 text-muted-foreground">
			Loading the interactive wheel poem…
		</div>
	)
}
