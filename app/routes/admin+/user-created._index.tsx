import { Link, type LoaderFunctionArgs, useLoaderData } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'

type WheelPoemRecord = {
	id: string
	sessionId: string
	text: string
	wheelSize: number | null
	sessionUpdatedAt: string
	createdAt: string
	updatedAt: string
}

type MathewsAlgorithmRecord = {
	id: string
	sessionId: string
	size: number
	shiftPasses: number
	filledCells: number
	sessionUpdatedAt: string
	createdAt: string
	updatedAt: string
}

function countFilledCells(rawTable: string) {
	try {
		const parsed = JSON.parse(rawTable) as unknown
		if (!Array.isArray(parsed)) return 0
		return parsed.reduce<number>((total, row) => {
			if (!Array.isArray(row)) return total
			return (
				total +
				row.filter(
					(value) => typeof value === 'string' && value.trim().length > 0,
				).length
			)
		}, 0)
	} catch {
		return 0
	}
}

export async function loader({}: LoaderFunctionArgs) {
	const [wheelPoems, mathewsAlgorithms] = await Promise.all([
		prisma.userCreatedWheelPoem.findMany({
			orderBy: { sessionUpdatedAt: 'desc' },
		}),
		prisma.userCreatedMathewsAlgorithm.findMany({
			orderBy: { sessionUpdatedAt: 'desc' },
		}),
	])

	const records: WheelPoemRecord[] = wheelPoems.map((record) => ({
		id: record.id,
		sessionId: record.sessionId,
		text: record.text,
		wheelSize: record.wheelSize,
		sessionUpdatedAt: record.sessionUpdatedAt.toISOString(),
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	}))

	const mathewsRecords: MathewsAlgorithmRecord[] = mathewsAlgorithms.map(
		(record) => ({
			id: record.id,
			sessionId: record.sessionId,
			size: record.size,
			shiftPasses: record.shiftPasses,
			filledCells: countFilledCells(record.table),
			sessionUpdatedAt: record.sessionUpdatedAt.toISOString(),
			createdAt: record.createdAt.toISOString(),
			updatedAt: record.updatedAt.toISOString(),
		}),
	)

	return { wheelPoems: records, mathewsAlgorithms: mathewsRecords }
}

export default function AdminUserCreatedIndexRoute() {
	const { wheelPoems, mathewsAlgorithms } = useLoaderData<typeof loader>()

	return (
		<div className="container flex flex-col gap-8 pb-16 pt-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold text-foreground">
					Records created by user interactivity
				</h1>
				<p className="text-muted-foreground">
					View data captured from interactive experiments.
				</p>
			</div>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Wheel poems</h2>
					<p className="text-sm text-muted-foreground">
						Most recent sessions saved from the Wheel Poem experiment.
					</p>
				</div>

				{wheelPoems.length === 0 ? (
					<p className="text-muted-foreground">
						No wheel poem sessions have been recorded yet.
					</p>
				) : (
					<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border/60 bg-card">
						{wheelPoems.map((record) => (
							<li key={record.id} className="p-4">
								<Link
									to={`wheel-poem/${record.id}`}
									className="group flex flex-col gap-2"
								>
									<div className="flex items-center justify-between gap-3">
										<span className="text-sm font-medium text-foreground group-hover:text-primary">
											{record.text
												? record.text.slice(0, 80) +
													(record.text.length > 80 ? '…' : '')
												: '(empty)'}
										</span>
										<time
											dateTime={record.sessionUpdatedAt}
											className="text-xs text-muted-foreground"
										>
											{new Date(record.sessionUpdatedAt).toLocaleString()}
										</time>
									</div>
									<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
										<span>Session: {record.sessionId}</span>
										{typeof record.wheelSize === 'number' ? (
											<span>Wheel size: {record.wheelSize.toFixed(2)}</span>
										) : null}
									</div>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">
						Mathews&apos; Algorithm
					</h2>
					<p className="text-sm text-muted-foreground">
						Most recent sessions saved from the Mathews&apos; Algorithm
						experiment.
					</p>
				</div>

				{mathewsAlgorithms.length === 0 ? (
					<p className="text-muted-foreground">
						No Mathews&apos; Algorithm sessions have been recorded yet.
					</p>
				) : (
					<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border/60 bg-card">
						{mathewsAlgorithms.map((record) => (
							<li key={record.id} className="p-4">
								<Link
									to={`mathews-algorithm/${record.id}`}
									className="group flex flex-col gap-2"
								>
									<div className="flex items-center justify-between gap-3">
										<span className="text-sm font-medium text-foreground group-hover:text-primary">
											{record.size}×{record.size} table, {record.filledCells}{' '}
											filled cells
										</span>
										<time
											dateTime={record.sessionUpdatedAt}
											className="text-xs text-muted-foreground"
										>
											{new Date(record.sessionUpdatedAt).toLocaleString()}
										</time>
									</div>
									<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
										<span>Session: {record.sessionId}</span>
										<span>Shift passes: {record.shiftPasses}</span>
									</div>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	)
}
