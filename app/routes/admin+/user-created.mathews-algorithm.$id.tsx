import { invariantResponse } from '@epic-web/invariant'
import { useCallback } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { type Route } from './+types/user-created.mathews-algorithm.$id'

const SESSION_STORAGE_KEY = 'mathews-algorithm-session'
const SESSION_ID_STORAGE_KEY = 'mathews-algorithm-session-id'

type MathewsSession = {
	size: number
	table: string[][]
	shiftPasses: number
}

function parseTable(raw: string): string[][] {
	try {
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return []
		return parsed.map((row) => {
			if (!Array.isArray(row)) return []
			return row.map((value) => (typeof value === 'string' ? value : ''))
		})
	} catch (error) {
		console.error('Failed to parse Mathews algorithm table', error)
		return []
	}
}

function formatSet(row: string[]) {
	const text = row
		.map((value) => value.trim())
		.filter(Boolean)
		.join(', ')
	return text || '(empty)'
}

export async function loader({ params, request }: Route.LoaderArgs) {
	await requireUserId(request)

	const record = await prisma.userCreatedMathewsAlgorithm.findUnique({
		where: { id: params.id },
	})

	invariantResponse(record, "Mathews' Algorithm record not found", {
		status: 404,
	})

	return {
		record: {
			id: record.id,
			sessionId: record.sessionId,
			size: record.size,
			table: parseTable(record.table),
			shiftPasses: record.shiftPasses,
			sessionUpdatedAt: record.sessionUpdatedAt.toISOString(),
			createdAt: record.createdAt.toISOString(),
			updatedAt: record.updatedAt.toISOString(),
		},
	}
}

export default function AdminUserCreatedMathewsAlgorithmDetailRoute() {
	const { record } = useLoaderData<typeof loader>()
	const navigate = useNavigate()

	const handleLoadIntoExperiment = useCallback(() => {
		if (typeof window === 'undefined') return

		const session: MathewsSession = {
			size: record.size,
			table: record.table,
			shiftPasses: record.shiftPasses,
		}

		try {
			window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
			window.localStorage.setItem(SESSION_ID_STORAGE_KEY, record.sessionId)

			void navigate('/experiments/mathews-algorithm')
		} catch (error) {
			console.error('Failed to prepare Mathews algorithm session', error)
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
					Mathews&apos; Algorithm session
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
						<dd className="break-all text-foreground">{record.sessionId}</dd>
					</div>
					<div className="space-y-1">
						<dt className="font-medium text-muted-foreground">Record ID</dt>
						<dd className="break-all text-foreground">{record.id}</dd>
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
						<dt className="font-medium text-muted-foreground">Table size</dt>
						<dd className="text-foreground">
							{record.size}×{record.size}
						</dd>
					</div>
					<div className="space-y-1">
						<dt className="font-medium text-muted-foreground">Shift passes</dt>
						<dd className="text-foreground">{record.shiftPasses}</dd>
					</div>
				</dl>

				<div className="space-y-2">
					<h2 className="text-sm font-medium text-muted-foreground">
						Input sets
					</h2>
					<div className="overflow-x-auto rounded-lg bg-muted/60 p-3">
						<table className="w-full min-w-[32rem] border-collapse text-sm">
							<tbody>
								{record.table.map((row, rowIndex) => (
									<tr
										key={`row-${rowIndex}`}
										className="border-b border-border/60"
									>
										<th className="w-24 px-3 py-2 text-left font-medium text-muted-foreground">
											Set {rowIndex + 1}
										</th>
										<td className="px-3 py-2 text-foreground">
											{formatSet(row)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="space-y-2">
					<h2 className="text-sm font-medium text-muted-foreground">
						Raw table
					</h2>
					<pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
						{JSON.stringify(record.table, null, 2)}
					</pre>
				</div>

				<Button
					type="button"
					onClick={handleLoadIntoExperiment}
					className="self-start"
				>
					Load in Mathews&apos; Algorithm experiment
				</Button>
			</section>
		</div>
	)
}
