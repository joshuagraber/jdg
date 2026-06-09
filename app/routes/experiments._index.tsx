import { Link, type MetaFunction } from 'react-router'
import { HOME_EXPERIMENT_PREVIEWS } from '#app/content/experiments'

export const meta: MetaFunction = () => [{ title: 'Experiments | JDG' }]

export default function ExperimentsIndexRoute() {
	return (
		<div className="container pb-24 pt-12">
			<h1 className="text-4xl font-semibold tracking-tight">Experiments</h1>
			<p className="mt-4 max-w-2xl text-lg text-muted-foreground">
				Playground space for in-progress digital poetics pieces and other
				interactive projects.
			</p>
			<div className="mt-12 grid gap-6 sm:grid-cols-2">
				{HOME_EXPERIMENT_PREVIEWS.map((experiment) => (
					<Link
						key={experiment.to}
						to={experiment.to}
						className="group flex flex-col justify-between rounded-3xl border border-border bg-card p-6 transition hover:border-foreground/70 hover:shadow-lg"
					>
						<div>
							<p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
								Experiment
							</p>
							<h2 className="mt-3 text-2xl font-semibold tracking-tight">
								{experiment.title.replace(' Experiment', '')}
							</h2>
							<p className="mt-3 text-base text-muted-foreground">
								{experiment.description}
							</p>
						</div>
						<span className="mt-6 inline-flex items-center text-sm font-medium text-primary">
							Enter experiment →
						</span>
					</Link>
				))}
			</div>
		</div>
	)
}
