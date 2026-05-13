import { getMDXComponent } from 'mdx-bundler/client'
import { useEffect, useMemo, useRef } from 'react'
import {
	data,
	Link,
	useLoaderData,
	useLocation,
	type HeadersFunction,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { mdxComponents } from '#app/components/mdx/index.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { FRAGMENTS_POSTS_PER_PAGE } from '#app/utils/fragments.ts'
import { getCachedFragmentsIndex } from '#app/utils/fragments.server.ts'
import { type LinkPreviewHandle } from '#app/utils/link-preview'
import { mergeMeta } from '#app/utils/merge-meta.ts'
import { makeTimings, time } from '#app/utils/timing.server.ts'
import { type Route } from './+types/_index'
import { PaginationBar } from './__pagination-bar'
import { Time } from './__time'

export const POSTS_PER_PAGE = FRAGMENTS_POSTS_PER_PAGE
const FRAGMENTS_DESCRIPTION = 'Collection of fragments and short posts'

export const handle: LinkPreviewHandle = {
	async linkPreview({ request }) {
		const url = new URL(request.url)
		return {
			url: '/fragments',
			title: 'Fragments | Joshua D. Graber',
			description: FRAGMENTS_DESCRIPTION,
			domain: url.hostname,
		}
	},
}

export async function loader({ request }: Route.LoaderArgs) {
	const timings = makeTimings('fragments index loader')
	const url = new URL(request.url ?? 'https://www.joshuadgraber.com')
	const top = Number(url.searchParams.get('top')) || POSTS_PER_PAGE
	const skip = Number(url.searchParams.get('skip')) || 0
	const cached = await time(
		() => getCachedFragmentsIndex({ top, skip }),
		{ timings, type: 'cache:fragments-index' },
	)

	return data(
		{
			posts: cached.posts,
			total: cached.total,
			ogURL: url,
		},
		{ headers: { 'Server-Timing': timings.toString() } },
	)
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
	return {
		'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
	}
}

export const meta: Route.MetaFunction = ({ data, matches }) => {
	const parentMeta = matches[matches.length - 2]?.meta ?? []

	return mergeMeta(parentMeta, [
		{ title: 'Fragments | Joshua D. Graber' },
		{
			name: 'description',
			property: 'description',
			content: FRAGMENTS_DESCRIPTION,
		},
		{
			name: 'og:description',
			property: 'og:description',
			content: FRAGMENTS_DESCRIPTION,
		},
		{
			property: 'og:title',
			name: 'og:title',
			content: 'Fragments | Joshua D. Graber',
		},
		{ property: 'og:url', content: data?.ogURL.toString() },
	])
}

function PostContent({ code }: { code: string }) {
	// Move this to useMemo to prevent recreating the component on every render
	const Component = useMemo(() => getMDXComponent(code), [code])
	return <Component components={mdxComponents} />
}

export default function Fragments() {
	const { posts, total } = useLoaderData<typeof loader>()
	const location = useLocation()
	const isFirstRender = useRef(true)

	// Ensure we scroll to the top whenever pagination (query) changes
	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false
			return
		}
		window.scrollTo({ top: 0, behavior: 'auto' })
	}, [location.search])

	return (
		<div className="jdg_typography mx-auto w-full max-w-screen-md p-8">
			<h1 className="mb-4 font-bold">Fragments</h1>
			<p>The closest I'll ever come to blogging.</p>
			<hr />
			<Spacer size="xs" />
			<div className="flex flex-col gap-6">
				{posts.map((post) => (
					<article key={post.id} className="max-w-none">
						<Link to={post.slug} className="text-primary no-underline">
							<h2 className="text-primary">{post.title}</h2>
							<p className="mb-2 text-muted-foreground">{post.description}</p>
						</Link>
						<p className="text-sm text-neutral-500">
							{post.publishAt ? (
								<Time time={new Date(post.publishAt).toDateString()} />
							) : null}
						</p>
						<div className="mb-4">
							<PostContent code={post.code} />
						</div>
					</article>
				))}

				<PaginationBar total={total} />
			</div>
		</div>
	)
}

export const ErrorBoundary = GeneralErrorBoundary
