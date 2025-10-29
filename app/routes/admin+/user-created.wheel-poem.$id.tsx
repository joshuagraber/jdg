import { invariantResponse } from '@epic-web/invariant'
import { useCallback } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { type Route } from './+types/user-created.wheel-poem.$id'

const SESSION_STORAGE_KEY = 'wheel-poem-sessions'
const PENDING_SESSION_STORAGE_KEY = 'wheel-poem-pending-session-id'
const MAX_SAVED_SESSIONS = 8

type StoredSession = {
	id: string
	text: string
	rotations: number[]
	wheelSize: number | null
	updatedAt: string
}

function parseRotations(raw: string): number[] {
	try {
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return []
		return parsed
			.slice(0, 10)
			.map((value) =>
				Number.isFinite(value as number) ? Number(value) : 0,
			) as number[]
	} catch (error) {
		console.error('Failed to parse wheel poem rotations', error)
		return []
	}
}

export async function loader({ params, request }: Route.LoaderArgs) {
	await requireUserId(request)

	const record = await prisma.userCreatedWheelPoem.findUnique({
		where: { id: params.id },
	})

	invariantResponse(record, 'Wheel poem record not found', { status: 404 })

	return {
		record: {
			id: record.id,
			sessionId: record.sessionId,
			text: record.text,
			rotations: parseRotations(record.rotations),
			wheelSize: record.wheelSize,
			sessionUpdatedAt: record.sessionUpdatedAt.toISOString(),
			createdAt: record.createdAt.toISOString(),
			updatedAt: record.updatedAt.toISOString(),
		},
	}
}

export default function AdminUserCreatedWheelPoemDetailRoute() {
	const { record } = useLoaderData<typeof loader>()
	const navigate = useNavigate()

	const handleLoadIntoExperiment = useCallback(() => {
		if (typeof window === 'undefined') return

		const session: StoredSession = {
			id: record.sessionId,
			text: record.text,
			rotations: record.rotations,
			wheelSize: record.wheelSize ?? null,
			updatedAt: record.sessionUpdatedAt,
		}

		try {
			const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
			let sessions: StoredSession[] = []
			if (raw) {
				const parsed = JSON.parse(raw) as unknown
				if (Array.isArray(parsed)) {
					sessions = parsed.filter((entry): entry is StoredSession => {
						if (!entry || typeof entry !== 'object') return false
						return (
							'id' in entry && typeof entry.id === 'string' &&
							'text' in entry && typeof entry.text === 'string' &&
							'rotations' in entry && Array.isArray(entry.rotations) &&
							'updatedAt' in entry && typeof entry.updatedAt === 'string'
						)
					})
				}
			}

			const existingIndex = sessions.findIndex(
				(existing) => existing.id === session.id,
			)
			if (existingIndex >= 0) {
				sessions[existingIndex] = session
			} else {
				sessions.unshift(session)
			}

			sessions.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))

			if (sessions.length > MAX_SAVED_SESSIONS) {
				sessions = sessions.slice(0, MAX_SAVED_SESSIONS)
			}

			window.localStorage.setItem(
				SESSION_STORAGE_KEY,
				JSON.stringify(sessions),
			)
			window.localStorage.setItem(PENDING_SESSION_STORAGE_KEY, session.id)

			void navigate('/experiments/wheel-poem')
		} catch (error) {
			console.error('Failed to prepare wheel poem session', error)
		}
	}, [navigate, record])

	return (
		<div className="container flex flex-col gap-6">
			<nav>
				<Link
					to="/admin/user-created"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Back to records
				</Link>
			</nav>

			<header className="space-y-2">
				<h1 className="text-3xl font-semibold text-foreground">
					Wheel poem session
				</h1>
				<p className="text-sm text-muted-foreground">
					Review the captured session data or load it directly into the
					experiment interface.
				</p>
			</header>

			<section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6">
				<dl className="grid gap-3 text-sm md:grid-cols-2">
					<div className="space-y-1">
						<dt className="font-medium text-muted-foreground">Session ID</dt>
						<dd className="text-foreground">{record.sessionId}</dd>
					</div>
					<div className="space-y-1">
						<dt className="font-medium text-muted-foreground">Record ID</dt>
						<dd className="text-foreground">{record.id}</dd>
					</div>
					<div className="space-y-1">
						<dt className="font-medium text-muted-foreground">
							Last updated (session)
						</dt>
						<dd className="text-foreground">
							{new Date(record.sessionUpdatedAt).toLocaleString()}
						</dd>
					</div>
					<div className="space-y-1">
						<dt className="font-medium text-muted-foreground">Wheel size</dt>
						<dd className="text-foreground">
							{typeof record.wheelSize === 'number'
								? record.wheelSize.toFixed(2)
								: '—'}
						</dd>
					</div>
					<div className="space-y-1 md:col-span-2">
						<dt className="font-medium text-muted-foreground">Original text</dt>
						<dd className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-foreground">
							{record.text || '(empty)'}
						</dd>
					</div>
				</dl>

				<div className="space-y-2">
					<h2 className="text-sm font-medium text-muted-foreground">
						Rotations
					</h2>
					<pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
						{JSON.stringify(record.rotations, null, 2)}
					</pre>
				</div>

				<Button
					type="button"
					onClick={handleLoadIntoExperiment}
					className="self-start"
				>
					Load in Wheel Poem experiment
				</Button>
			</section>
		</div>
	)
}
