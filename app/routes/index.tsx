import {
	data,
	Link,
	useLoaderData,
	type HeadersFunction,
	type LoaderFunctionArgs,
} from 'react-router'
import { InternalLinkPreview } from '#app/components/link-preview-internal'
import { LinkPreview } from '#app/components/link-preview'
import { Spacer } from '#app/components/spacer'
import {
	HOME_EXPERIMENT_PREVIEWS,
	type ExperimentPreviewConfig,
} from '#app/content/experiments'
import { getHints } from '#app/utils/client-hints.tsx'
import { prisma } from '#app/utils/db.server'
import { getFragmentPreviewData } from '#app/utils/fragments.ts'
import { getHomeLinkUrls } from '#app/utils/home-links.server.ts'
import { makeTimings, time } from '#app/utils/timing.server.ts'
import { Time } from './fragments+/__time'

function resolveExperimentImage(
	theme: string | null | undefined,
	preview: ExperimentPreviewConfig,
) {
	return theme === 'dark' ? preview.images.dark : preview.images.light
}

export async function loader({ request }: LoaderFunctionArgs) {
	const timings = makeTimings('index loader')
	const recentFragments = await time(
		() =>
			prisma.post.findMany({
				where: {
					publishAt: {
						not: null,
						lte: new Date(),
					},
				},
				select: {
					title: true,
					slug: true,
					description: true,
					publishAt: true,
					previewTitle: true,
					previewDescription: true,
					previewImageId: true,
					previewImage: {
						select: { s3Key: true },
					},
				},
				orderBy: {
					publishAt: 'desc',
				},
				take: 4,
			}),
		{ timings, type: 'db:recent-fragments' },
	)

	const publicationUrls = await time(() => getHomeLinkUrls('writing'), {
		timings,
		type: 'db:home-link-urls',
	})

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

	return data(
		{
			fragments: recentFragments,
			publicationUrls: publicationUrls.slice(0, 4),
			experimentPreviews,
			siteHostname,
		},
		{ headers: { 'Server-Timing': timings.toString() } },
	)
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
	return {
		'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
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
					const preview = getFragmentPreviewData(fragment)
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
				{data.publicationUrls.map((url) => (
					<li key={url}>
						<LinkPreview url={url} className="w-full max-w-3xl" />
					</li>
				))}
			</ul>
			<Spacer size="lg" />
		</main>
	)
}
