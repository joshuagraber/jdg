import { getMDXComponent } from 'mdx-bundler/client'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useLoaderData, useLocation } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { mdxComponents } from '#app/components/mdx/index.tsx'
import { prisma } from '#app/utils/db.server'
import { compileMDX } from '#app/utils/mdx.server'
import { mergeMeta } from '#app/utils/merge-meta.ts'
import { type Route } from './+types/_index'
import { PaginationBar } from './__pagination-bar'
import { Time } from './__time'

export const POSTS_PER_PAGE = 5

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url ?? 'https://www.joshuadgraber.com')
	const top = Number(url.searchParams.get('top')) || POSTS_PER_PAGE
	const skip = Number(url.searchParams.get('skip')) || 0

	const [posts, totalPosts] = await Promise.all([
		prisma.post.findMany({
			where: { publishAt: { not: null } },
			select: {
				id: true,
				title: true,
				slug: true,
				content: true,
				description: true,
				createdAt: true,
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

	// Bundle MDX for each post
	const postsWithMDX = await Promise.all(
		posts.map(async (post) => {
			const { code, frontmatter } = await compileMDX(post.content, { title: post.title })
			return {
				...post,
				code,
				frontmatter,
			}
		}),
	)

	return {
		posts: postsWithMDX,
		total: totalPosts,
		ogURL: url,
	}
}

export const meta: Route.MetaFunction = ({ data, matches }) => {
	const parentMeta = matches[matches.length - 2]?.meta ?? []

	return mergeMeta(parentMeta, [
		{ title: 'Fragments | Joshua D. Graber' },
		{
			name: 'description',
			property: 'description',
			content: 'Collection of fragments and short posts',
		},
		{
			name: 'og:description',
			property: 'og:description',
			content: 'Collection of fragments and short posts',
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
			<div className="flex flex-col gap-6">
				{posts.map((post) => (
					<article key={post.id} className="max-w-none">
						<Link to={post.slug} className="text-primary no-underline">
							<h2 className="text-primary">{post.title}</h2>
							<p className="mb-2 text-muted-foreground">{post.description}</p>
						</Link>
						<p className="text-sm text-neutral-500">
							{/* Non-null assertion okay here. If the post is returned here, that means it's published */}
							<Time time={post.publishAt!.toDateString()} />
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
