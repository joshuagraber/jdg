import { Link, type MetaFunction } from 'react-router'
import { Spacer } from '#app/components/spacer'

export const meta: MetaFunction = () => [{ title: 'Editing | Joshua D. Graber' }]

export default function EditingRoute() {
	return (
		<main className="container">
			<Spacer size="4xs" />
			<h1>Editing</h1>
			<Spacer size="4xs" />
			<p>
				For nearly 15 years, I&apos;ve worked as a literary editor of prose and
				poetry. As an undergraduate, I became the founding executive editor of{' '}
				<em>The Quaker</em>.
				<Spacer size="4xs" />In graduate school, I served as fiction editor for{' '}
				<a
					href="https://en.wikipedia.org/wiki/Hot_Metal_Bridge_(journal)/"
					rel="noreferrer noopener"
					target="blank"
				>
					<em>Hot Metal Bridge</em>
				</a>{' '}
				and as managing editor for{' '}
				<a href="https://asterixjournal.com/" rel="noreferrer noopener" target="blank">
					<em>Aster(ix)</em>
				</a>
				.
				<Spacer size="4xs" />After earning my degree, I became the founding
				fiction editor of{' '}
				<a href="https://www.wordwest.co" rel="noreferrer noopener" target="blank">
					Word West Press
				</a>
				, working on an array of remarkable books across styles and genres.
				<Spacer size="4xs" />I&apos;m available for freelance editorial work&mdash;
				<Link to="/contact">say hello</Link> or check out{' '}
				<a href="https://reedsy.com/joshua-graber" rel="noreferrer noopener" target="blank">
					my profile on Reedsy
				</a>
				.
			</p>
			<Spacer size="lg" />
		</main>
	)
}
