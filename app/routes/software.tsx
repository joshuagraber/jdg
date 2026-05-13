import { Link, type MetaFunction } from 'react-router'
import { Spacer } from '#app/components/spacer'

export const meta: MetaFunction = () => [
	{ title: 'Software | Joshua D. Graber' },
]

export default function SoftwareRoute() {
	return (
		<main className="container">
			<Spacer size="4xs" />
			<h1>Software</h1>
			<Spacer size="4xs" />
			<p>
				I currently work as a software engineer for{' '}
				<a href="https://www.aura.com" rel="noreferrer noopener" target="blank">
					Aura
				</a>
				, a consumer digital safety company.
				<Spacer size="4xs" />I also maintain the open-source client applications
				for the{' '}
				<a href="https://www.pdap.io" rel="noreferrer noopener" target="blank">
					Police Data Accessibility Project
				</a>
				, dedicated to making police data accessible to researchers,
				journalists, and communities impacted by policing.
				<Spacer size="4xs" />I am occasionally available for engineering
				projects on a freelance basis. Please{' '}
				<Link to="/contact">get in touch</Link> if you are interested in
				collaborating.
			</p>
			<Spacer size="lg" />
		</main>
	)
}
