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
import { cachified, cache } from '#app/utils/cache.server.ts'
import { prisma } from '#app/utils/db.server'
import { type LinkPreviewHandle } from '#app/utils/link-preview'
import { compileMDX } from '#app/utils/mdx.server'
import { mergeMeta } from '#app/utils/merge-meta.ts'
import { makeTimings, time } from '#app/utils/timing.server.ts'
import { type Route } from './+types/_index'
import { PaginationBar } from './__pagination-bar'
import { Time } from './__time'

export const POSTS_PER_PAGE = 5
const FRAGMENTS_DESCRIPTION = 'Collection of fragments and short posts'
const MDX_LIST_COMPILE_CONCURRENCY = 1
const FRAGMENTS_ROUTE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 365
const FRAGMENTS_ROUTE_CACHE_SWR_MS = 1000 * 60 * 60 * 24 * 30

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

	const publishedVersion = await time(
		() =>
			prisma.post.aggregate({
				where: { publishAt: { not: null } },
				_count: { _all: true },
				_max: { updatedAt: true },
			}),
		{ timings, type: 'db:published-version' },
	)

	const versionUpdatedAt = publishedVersion._max.updatedAt?.getTime() ?? 0
	const versionCount = publishedVersion._count._all
	const cached = await time(
		() =>
			cachified({
				key: `fragments:index:v1:top:${top}:skip:${skip}:count:${versionCount}:updatedAt:${versionUpdatedAt}`,
				cache,
				ttl: FRAGMENTS_ROUTE_CACHE_TTL_MS,
				swr: FRAGMENTS_ROUTE_CACHE_SWR_MS,
				async getFreshValue() {
					const [posts, totalPosts] = await Promise.all([
						prisma.post.findMany({
							where: { publishAt: { not: null } },
							select: {
								id: true,
								title: true,
								slug: true,
								content: true,
								description: true,
								publishAt: true,
							},
							orderBy: { publishAt: 'desc' },
							take: top,
							skip,
						}),
						prisma.post.count({
							where: { publishAt: { not: null } },
						}),
					])

					// Bundle MDX with constrained concurrency to avoid CPU spikes that can
					// starve health checks on smaller Fly machines.
					const postsWithMDX = await mapWithConcurrency(
						posts,
						MDX_LIST_COMPILE_CONCURRENCY,
						async (post) => {
							const { code, frontmatter } = await compileMDX(post.content, {
								title: post.title,
							})
							return {
								id: post.id,
								title: post.title,
								slug: post.slug,
								description: post.description,
								publishAt: post.publishAt?.toISOString() ?? null,
								code,
								frontmatter,
							}
						},
					)

					return {
						posts: postsWithMDX,
						total: totalPosts,
					}
				},
			}),
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

async function mapWithConcurrency<TIn, TOut>(
	items: Array<TIn>,
	concurrency: number,
	mapper: (item: TIn, index: number) => Promise<TOut>,
): Promise<Array<TOut>> {
	if (!items.length) return []
	const limit = Math.max(1, concurrency)
	const output = new Array<TOut>(items.length)
	let index = 0

	const worker = async () => {
		while (true) {
			const current = index++
			if (current >= items.length) break
			output[current] = await mapper(items[current]!, current)
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () => worker()),
	)
	return output
}
