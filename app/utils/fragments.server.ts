import { cachified, cache } from '#app/utils/cache.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { compileMDX } from '#app/utils/mdx.server.ts'

const FRAGMENT_SLUG_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 365
const FRAGMENT_SLUG_CACHE_SWR_MS = 1000 * 60 * 60 * 24 * 30

export function getFragmentSlugCacheKey(slug: string, updatedAt: Date | number) {
	const updatedAtMs =
		updatedAt instanceof Date ? updatedAt.getTime() : updatedAt
	return `fragments:slug:v1:${slug}:updatedAt:${updatedAtMs}`
}

export async function getCachedFragmentBySlug({
	slug,
	updatedAt,
}: {
	slug: string
	updatedAt: Date | number
}) {
	return cachified({
		key: getFragmentSlugCacheKey(slug, updatedAt),
		cache,
		ttl: FRAGMENT_SLUG_CACHE_TTL_MS,
		swr: FRAGMENT_SLUG_CACHE_SWR_MS,
		async getFreshValue() {
			const post = await prisma.post.findUnique({
				where: {
					slug,
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
	})
}

export async function warmPublishedFragment(slug: string) {
	const version = await prisma.post.findUnique({
		where: { slug },
		select: {
			updatedAt: true,
			publishAt: true,
		},
	})

	if (!version?.publishAt) return null

	return getCachedFragmentBySlug({
		slug,
		updatedAt: version.updatedAt,
	})
}
