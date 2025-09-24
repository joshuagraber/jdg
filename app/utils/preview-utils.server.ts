import crypto from 'node:crypto'
import { cache } from '#app/utils/cache.server.ts'

const MDX_CACHE_PREFIX_V2 = 'mdx:bundle:'
const INTERNAL_PREVIEW_CACHE_PREFIX = 'internal-link-preview:'

export function mdxCacheKeyFor(source: string, title?: string) {
	const hash = crypto.createHash('sha1').update(source).digest('hex')
	const titlePart = title?.trim() ? title.trim() : 'untitled'
	return `${MDX_CACHE_PREFIX_V2}${titlePart}:${hash}`
}

export function internalPreviewCacheKey(slug: string) {
	return `${INTERNAL_PREVIEW_CACHE_PREFIX}${slug}`
}

export function extractPreviewUrls(markdown: string): string[] {
	const urls = new Set<string>()
	if (!markdown) return []

	// Matches :preview{url=...} or :preview{#=...}
	const re = /:preview\{([^}]*)\}/gim
	let m: RegExpExecArray | null
	while ((m = re.exec(markdown))) {
		const inside = m[1] ?? ''
		// Try url=...
		const urlMatch = inside.match(/\burl\s*=\s*([^\s}]+)/i)
		// Or shorthand #=...
		const hashMatch = inside.match(/#\s*=\s*([^\s}]+)/)
		const raw = (urlMatch?.[1] || hashMatch?.[1] || '').trim()
		if (!raw) continue
		const cleaned = raw.replace(/^['"]|['"]$/g, '')
		urls.add(cleaned)
	}

	return Array.from(urls)
}

export async function invalidatePostCaches(
	oldContent?: string,
	newContent?: string,
	oldTitle?: string,
	_newTitle?: string,
	oldSlug?: string,
	newSlug?: string,
) {
	const oldUrls = new Set(oldContent ? extractPreviewUrls(oldContent) : [])
	const newUrls = new Set(newContent ? extractPreviewUrls(newContent) : [])

	// Only remove preview cache entries that no longer exist in the post.
	const removedUrls = Array.from(oldUrls).filter((url) => !newUrls.has(url))
	if (removedUrls.length > 0) {
		await Promise.all(
			removedUrls.map((url) =>
				cache.delete?.(`link-preview:${url}`)?.catch(() => undefined),
			),
		)
	}

	// Internal preview cache entries should always be invalidated so the
	// homepage/module listings pick up edits like title/description changes.
	const slugs = new Set<string>()
	if (oldSlug) slugs.add(oldSlug)
	if (newSlug) slugs.add(newSlug)
	if (slugs.size > 0) {
		await Promise.all(
			Array.from(slugs).map((slug) =>
				cache
					.delete?.(internalPreviewCacheKey(slug))
					?.catch(() => undefined),
			),
		)
	}

	// MDX compilation cache keys are content-hashed, so new content gets a
	// brand-new cache entry automatically. Keeping the old entry avoids a
	// forced recompile while the stale-while-revalidate job catches up.
	if (oldContent && oldTitle) {
		void cache
			.delete?.(mdxCacheKeyFor(oldContent, oldTitle))
			?.catch(() => undefined)
	}
}
