import { cachified, cache } from '#app/utils/cache.server.ts'
import { prisma } from '#app/utils/db.server'
import {
	type InternalLinkPreviewData,
	type LinkPreviewHandleContext,
} from '#app/utils/link-preview'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { internalPreviewCacheKey } from '#app/utils/preview-utils.server.ts'

export async function resolveFragmentLinkPreview({
	params,
}: LinkPreviewHandleContext): Promise<InternalLinkPreviewData | null> {
	const slug = params.slug
	if (!slug) return null

	return await cachified({
		key: internalPreviewCacheKey(slug),
		cache,
		ttl: 1000 * 60 * 10,
		swr: 1000 * 60 * 60,
		async getFreshValue(context) {
			const post = await prisma.post.findFirst({
				where: {
					slug,
					publishAt: { not: null },
				},
				select: {
					title: true,
					description: true,
					slug: true,
					previewTitle: true,
					previewDescription: true,
					previewImageId: true,
				},
			})

			if (!post) {
				context.metadata.ttl = 0
				return null
			}

			const previewTitle = post.previewTitle ?? post.title
			const previewDescription = post.previewDescription ?? post.description
			const image = post.previewImageId
				? getPostImageSource(post.previewImageId)
				: null

			return {
				url: `/fragments/${post.slug}`,
				title: previewTitle,
				description: previewDescription,
				image,
				domain: null,
			}
		},
	})
}
