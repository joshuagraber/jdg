import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, type MetaFunction, useLoaderData } from '@remix-run/react'
import { getMDXComponent } from 'mdx-bundler/client'
import { useMemo } from 'react'
import { serverOnly$ } from 'vite-env-only/macros'
import { mdxComponents } from '#app/components/mdx/index.tsx'
import { prisma } from '#app/utils/db.server'
import { compileMDX } from '#app/utils/mdx.server'
import { PaginationBar } from './__pagination-bar'
import { Time } from './__time'

export const POSTS_PER_PAGE = 5

export const handle: SEOHandle = {
	getSitemapEntries: serverOnly$(async (request) => {
		const fragments = await prisma.post.findMany()
		return fragments.map((post) => {
			return { route: `/fragments/${post.slug}`, priority: 0.7 }
		})
	}),
}

export const meta: MetaFunction = () => {
	return [
		{ title: 'Fragments | Joshua D. Graber' },
		{
			name: 'description',
			content: 'Collection of code fragments and short posts',
		},
		{ property: 'og:title', content: 'Fragments | Joshua D. Graber' },
		{
			property: 'og:description',
			content: 'Collection of code fragments and short posts',
		},
		{ property: 'og:type', content: 'website' },
		{ property: 'og:image', content: '/img/primary.png' },
		{ property: 'og:url', content: 'https://joshuagraber.com/fragments' },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
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
			const { code, frontmatter } = await compileMDX(post.content)
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
	}
}

function PostContent({ code }: { code: string }) {
	// Move this to useMemo to prevent recreating the component on every render
	const Component = useMemo(() => getMDXComponent(code), [code])
	return <Component components={mdxComponents} />
}

export default function Fragments() {
	const { posts, total } = useLoaderData<typeof loader>()

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
