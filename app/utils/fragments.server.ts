import { cachified, cache } from '#app/utils/cache.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { compileMDX } from '#app/utils/mdx.server.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'

const FRAGMENT_SLUG_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 365
const FRAGMENT_SLUG_CACHE_SWR_MS = 1000 * 60 * 60 * 24 * 30
const FRAGMENTS_INDEX_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 365
const FRAGMENTS_INDEX_CACHE_SWR_MS = 1000 * 60 * 60 * 24 * 30
const DEFAULT_INDEX_WARM_PAGE_COUNT = 3

async function getPublishedVersion() {
	const publishedVersion = await prisma.post.aggregate({
		where: { publishAt: { not: null } },
		_count: { _all: true },
		_max: { updatedAt: true },
	})

	return {
		versionCount: publishedVersion._count._all,
		versionUpdatedAt: publishedVersion._max.updatedAt?.getTime() ?? 0,
	}
}

export function getFragmentsIndexCacheKey({
	top,
	skip,
	versionCount,
	versionUpdatedAt,
}: {
	top: number
	skip: number
	versionCount: number
	versionUpdatedAt: number
}) {
	return `fragments:index:v1:top:${top}:skip:${skip}:count:${versionCount}:updatedAt:${versionUpdatedAt}`
}

export function getFragmentSlugCacheKey(
	slug: string,
	updatedAt: Date | number,
) {
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

export async function getCachedFragmentsIndex({
	top,
	skip,
}: {
	top: number
	skip: number
}) {
	const { versionCount, versionUpdatedAt } = await getPublishedVersion()

	return cachified({
		key: getFragmentsIndexCacheKey({
			top,
			skip,
			versionCount,
			versionUpdatedAt,
		}),
		cache,
		ttl: FRAGMENTS_INDEX_CACHE_TTL_MS,
		swr: FRAGMENTS_INDEX_CACHE_SWR_MS,
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

			const postsWithMDX = await Promise.all(
				posts.map(async (post) => {
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
				}),
			)

			return {
				posts: postsWithMDX,
				total: totalPosts,
			}
		},
	})
}

export async function warmFragmentsIndexPages({
	top,
	pageCount = DEFAULT_INDEX_WARM_PAGE_COUNT,
}: {
	top: number
	pageCount?: number
}) {
	const limit = Math.max(1, pageCount)
	return Promise.all(
		Array.from({ length: limit }, (_, pageIndex) =>
			getCachedFragmentsIndex({
				top,
				skip: pageIndex * top,
			}).catch((error) => {
				console.warn('fragments index prewarm error', {
					top,
					skip: pageIndex * top,
					error,
				})
				return null
			}),
		),
	)
}
