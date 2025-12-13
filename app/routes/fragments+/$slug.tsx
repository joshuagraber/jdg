import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { getMDXComponent } from 'mdx-bundler/client'
import { useMemo } from 'react'
import { useLoaderData } from 'react-router'
import { serverOnly$ } from 'vite-env-only/macros'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { mdxComponents } from '#app/components/mdx/index.tsx'
import { prisma } from '#app/utils/db.server'
import { type LinkPreviewHandle } from '#app/utils/link-preview'
import { compileMDX } from '#app/utils/mdx.server'
import { mergeMeta } from '#app/utils/merge-meta.ts'
import { toAbsoluteUrl, getPostImageSource } from '#app/utils/misc.tsx'
import { type Route } from './+types/$slug'
import { Time } from './__time'

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
	const url = new URL(request.url)
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

	invariantResponse(post, 'Not found', { status: 404 })

	const { code } = await compileMDX(post.content, { title: post.title })
	const previewImageUrl = post.previewImageId
		? getPostImageSource(post.previewImageId, {
				s3Key: post.previewImage?.s3Key ?? null,
			})
		: null

	return { post, code, ogURL: url, previewImageUrl }
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
				{/* Non-null assertion okay here. If the post is returned here, that means it's published */}
				<Time time={post.publishAt!.toDateString()} />
			</p>
			<div>
				<Component components={mdxComponents} />
			</div>
		</div>
	)
}

export const ErrorBoundary = GeneralErrorBoundary
