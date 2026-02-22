import { useLoaderData, Link, type LoaderFunctionArgs } from 'react-router'
import { InternalLinkPreview } from '#app/components/link-preview-internal'
import { LinkPreviewStatic } from '#app/components/link-preview-static'
import { Spacer } from '#app/components/spacer'
import {
	HOME_EXPERIMENT_PREVIEWS,
	type ExperimentPreviewConfig,
} from '#app/content/experiments'
import { getHints } from '#app/utils/client-hints.tsx'
import { prisma } from '#app/utils/db.server'
import {
	getHomeLinkPreviews,
	getHomeLinkUrls,
} from '#app/utils/home-links.server.ts'
import { getInternalLinkPreviews } from '#app/utils/internal-link-previews.server.ts'
import { Time } from './fragments+/__time'

function resolveExperimentImage(
	theme: string | null | undefined,
	preview: ExperimentPreviewConfig,
) {
	return theme === 'dark' ? preview.images.dark : preview.images.light
}

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
	const publicationPreviews = await getHomeLinkPreviews(publicationUrls.slice(0, 4))

	const siteHostname = new URL(request.url).hostname
	const hints = getHints(request)
	const experimentPreviews = HOME_EXPERIMENT_PREVIEWS.map((preview) => {
		const image = resolveExperimentImage(hints.theme, preview)
		return {
			to: preview.to,
			data: {
				url: preview.url,
				title: preview.title,
				description: preview.description,
				image,
				imageLight: preview.images.light,
				imageDark: preview.images.dark,
				imageAlt: preview.imageAlt,
				domain: siteHostname,
			},
		}
	})

	return {
		fragments: recentFragments,
		fragmentLinkPreviews,
		publicationPreviews,
		experimentPreviews,
		siteHostname,
	}
}

export default function Index() {
	const data = useLoaderData<typeof loader>()

	return (
		<main className="container">
			<Spacer size="4xs" />
			<h1>Joshua D. Graber</h1>
			<Spacer size="4xs" />
			<p>
				Hi I&apos;m Joshua. I currently work as a writer, editor, and software
				engineer, with a career that has spanned writing, tech, and education.
				Along the way, I&apos;ve also worked as a professor, activist, tutor,
				bartender, landscaper, farm worker, and dishwasher.
			</p>
			<Spacer size="4xs" />
			<p>
				Learn more about my <Link to="/writing">writing</Link>,{' '}
				<Link to="/editing">editing</Link>, and{' '}
				<Link to="/software">software work</Link>.
			</p>
			<Spacer size="2xs" />
			<h2>Experiments</h2>
			<Spacer size="4xs" />
			<p>Experiments in digital poetics and programming</p>
			<Spacer size="5xs" />
			<ul className="flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:grow [&>*]:basis-full sm:[&>*]:shrink-0 sm:[&>*]:basis-[450px]">
				{data.experimentPreviews.map((preview) => (
					<li key={preview.to}>
						<InternalLinkPreview
							to={preview.to}
							data={preview.data}
							className="w-full max-w-3xl"
						/>
					</li>
				))}
			</ul>
			<Spacer size="2xs" />
			<h2>Recent fragments</h2>
			<Spacer size="4xs" />
			<Link to="fragments">View all fragments</Link>
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
			<Spacer size="2xs" />
			<h2>Recent publications</h2>
			<Spacer size="4xs" />
			<Link to="/writing">View all writing</Link>
			<ul className="my-4 flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:grow [&>*]:basis-full sm:[&>*]:shrink-0 sm:[&>*]:basis-[450px]">
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
