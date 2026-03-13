import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { getMDXComponent } from 'mdx-bundler/client'
import { useMemo } from 'react'
import { data, useLoaderData, type HeadersFunction } from 'react-router'
import { serverOnly$ } from 'vite-env-only/macros'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { mdxComponents } from '#app/components/mdx/index.tsx'
import { cachified, cache } from '#app/utils/cache.server.ts'
import { prisma } from '#app/utils/db.server'
import { type LinkPreviewHandle } from '#app/utils/link-preview'
import { compileMDX } from '#app/utils/mdx.server'
import { mergeMeta } from '#app/utils/merge-meta.ts'
import { toAbsoluteUrl, getPostImageSource } from '#app/utils/misc.tsx'
import { makeTimings, time } from '#app/utils/timing.server.ts'
import { type Route } from './+types/$slug'
import { Time } from './__time'

const FRAGMENT_SLUG_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 365
const FRAGMENT_SLUG_CACHE_SWR_MS = 1000 * 60 * 60 * 24 * 30

export const handle: SEOHandle & LinkPreviewHandle = {
	getSitemapEntries: serverOnly$(async (_request) => {
		const fragments = await prisma.post.findMany()
		return fragments.map((post) => {
			return { route: `/fragments/${post.slug}`, priority: 0.7 }
		})
	}),
	linkPreview: serverOnly$(async (context) => {
		const { resolveFragmentLinkPreview } = await import(
			'./$slug.preview.server.ts'
		)
		return resolveFragmentLinkPreview(context)
	}),
}

export async function loader({ params, request }: Route.LoaderArgs) {
	const timings = makeTimings('fragment slug loader')
	const url = new URL(request.url)
	const version = await time(
		() =>
			prisma.post.findUnique({
				where: {
					slug: params.slug,
				},
				select: {
					id: true,
					publishAt: true,
					updatedAt: true,
				},
			}),
		{ timings, type: 'db:fragment-version' },
	)

	invariantResponse(version?.publishAt, 'Not found', { status: 404 })

	const cached = await time(
		() =>
			cachified({
				key: `fragments:slug:v1:${params.slug}:updatedAt:${version.updatedAt.getTime()}`,
				cache,
				ttl: FRAGMENT_SLUG_CACHE_TTL_MS,
				swr: FRAGMENT_SLUG_CACHE_SWR_MS,
				async getFreshValue() {
					const post = await prisma.post.findUnique({
						where: {
							slug: params.slug,
							publishAt: { not: null },
						},
						select: {
							content: true,
							publishAt: true,
							title: true,
							description: true,
							slug: true,
							previewImageId: true,
							previewImage: {
								select: { s3Key: true },
							},
						},
					})

					if (!post) {
						throw new Response('Not found', { status: 404 })
					}

					const { code } = await compileMDX(post.content, { title: post.title })
					const previewImageUrl = post.previewImageId
						? getPostImageSource(post.previewImageId, {
								s3Key: post.previewImage?.s3Key ?? null,
							})
						: null

					return {
						post: {
							...post,
							publishAt: post.publishAt?.toISOString() ?? null,
						},
						code,
						previewImageUrl,
					}
				},
			}),
		{ timings, type: 'cache:fragment-slug' },
	)

	return data(
		{
			post: cached.post,
			code: cached.code,
			ogURL: url,
			previewImageUrl: cached.previewImageUrl,
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

	if (!data?.post) {
		return mergeMeta(parentMeta, [
			{ title: 'Fragment Not Found | Joshua D. Graber' },
			{ description: 'No fragment found' },
		])
	}

	const { post } = data
	const imageUrl = data.previewImageUrl
	const absoluteImageUrl = toAbsoluteUrl(imageUrl, data.ogURL)

	return mergeMeta(parentMeta, [
		{ title: `${post.title} | Joshua D. Graber` },
		{
			name: 'description',
			property: 'description',
			content: `Fragment: ${post.title}${post.description ? ', ' + post.description : ''}`,
		},
		{ property: 'og:title', name: 'og:title', content: post.title },
		{
			property: 'og:description',
			name: 'og:description',
			content: `Fragment: ${post.title}${post.description ? ', ' + post.description : ''}`,
		},
		{ property: 'og:type', name: 'og:type', content: 'article' },
		{
			property: 'og:url',
			name: 'og:url',
			content: data?.ogURL.toString(),
		},
		...(absoluteImageUrl
			? [
					{ property: 'og:image', name: 'og:image', content: absoluteImageUrl },
					{
						property: 'og:image:alt',
						name: 'og:image:alt',
						content: post.title,
					},
					{ name: 'twitter:card', content: 'summary_large_image' },
					{ name: 'twitter:image', content: absoluteImageUrl },
				]
			: []),
	])
}

export default function Fragment() {
	const { post, code } = useLoaderData<typeof loader>()
	const Component = useMemo(() => getMDXComponent(code), [code])

	return (
		<div className="jdg_typography mx-auto w-full max-w-screen-md p-8">
			<h1 className="mb-4">{post.title}</h1>
			<p>{post.description}</p>
			<p className="text-sm text-neutral-500">
				{post.publishAt ? (
					<Time time={new Date(post.publishAt).toDateString()} />
				) : null}
			</p>
			<div>
				<Component components={mdxComponents} />
			</div>
		</div>
	)
}

export const ErrorBoundary = GeneralErrorBoundary
