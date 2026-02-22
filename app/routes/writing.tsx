import { Link, useLoaderData, type LoaderFunctionArgs, type MetaFunction } from 'react-router'
import { InternalLinkPreview } from '#app/components/link-preview-internal'
import { LinkPreviewStatic } from '#app/components/link-preview-static'
import { Spacer } from '#app/components/spacer'
import { prisma } from '#app/utils/db.server'
import {
	getHomeLinkPreviews,
	getHomeLinkUrls,
} from '#app/utils/home-links.server.ts'
import { getInternalLinkPreviews } from '#app/utils/internal-link-previews.server.ts'
import { Time } from './fragments+/__time'

export const meta: MetaFunction = () => [{ title: 'Writing | Joshua D. Graber' }]

export async function loader({ request }: LoaderFunctionArgs) {
	const recentFragments = await prisma.post.findMany({
		where: {
			publishAt: {
				not: null,
				lte: new Date(),
			},
		},
		orderBy: {
			publishAt: 'desc',
		},
		take: 4,
	})

	const fragmentPaths = recentFragments.map(
		(fragment) => `/fragments/${fragment.slug}`,
	)
	const fragmentLinkPreviews = await getInternalLinkPreviews(
		fragmentPaths,
		request,
	)

	const publicationUrls = await getHomeLinkUrls('writing')
	const publicationPreviews = await getHomeLinkPreviews(publicationUrls)
	const siteHostname = new URL(request.url).hostname

	return {
		fragments: recentFragments,
		fragmentLinkPreviews,
		publicationPreviews,
		siteHostname,
	}
}

export default function WritingRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<main className="container">
			<Spacer size="4xs" />
			<h1>Writing</h1>
			<Spacer size="4xs" />
			<p>
				I&apos;m trained as a fiction writer (M.F.A.,{' '}
				<a
					href="https://www.writing.pitt.edu/graduate"
					rel="noreferrer noopener"
					target="blank"
				>
					University of Pittsburgh
				</a>
				) and have published fiction, poetry, essays, and genre-bending work in
				journals and publications including <em>Guernica</em>, <em>diagram</em>,{' '}
				<em>Glimmer Train</em>, <em>The New Guard Review</em>
				&apos;s BANG!, the Pittsburgh <em>Post Gazette</em>,{' '}
				<em>Adroit Journal</em>, and <em>Art Review</em>.
				<Spacer size="4xs" />I also write and produce audio documentary, and I&apos;m
				a founder of the storytelling collective{' '}
				<a
					href="https://www.coolmolecules.media/"
					rel="noreferrer noopener"
					target="blank"
				>
					Cool Molecules Media
				</a>
				.
			</p>
			<Spacer size="3xs" />
			<h2>Recent fragments</h2>
			<Spacer size="4xs" />
			<Link to="/fragments">View all fragments</Link>
			<ul className="my-4 flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:grow [&>*]:basis-full sm:[&>*]:shrink-0 sm:[&>*]:basis-[450px]">
				{data.fragments.map((fragment) => {
					const path = `/fragments/${fragment.slug}`
					const preview = data.fragmentLinkPreviews[path] ?? {
						url: path,
						title: fragment.title,
						description: fragment.description,
						domain: data.siteHostname,
					}
					const publishMeta = fragment.publishAt ? (
						<Time time={fragment.publishAt.toDateString()} />
					) : null
					return (
						<li key={fragment.title + fragment.slug}>
							<InternalLinkPreview
								to={path}
								data={preview}
								className="w-full max-w-3xl"
								meta={publishMeta}
							/>
						</li>
					)
				})}
			</ul>
			<Spacer size="3xs" />
			<h2>Recent publications</h2>
			<Spacer size="5xs" />
			<ul className="flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:grow [&>*]:basis-full sm:[&>*]:shrink-0 sm:[&>*]:basis-[450px]">
				{data.publicationPreviews.map((preview) => (
					<li key={preview.url}>
						<LinkPreviewStatic className="w-full max-w-3xl" {...preview} />
					</li>
				))}
			</ul>
			<Spacer size="lg" />
		</main>
	)
}
