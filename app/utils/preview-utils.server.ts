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
	newTitle?: string,
	oldSlug?: string,
	newSlug?: string,
) {
	const urls = new Set<string>([
		...(oldContent ? extractPreviewUrls(oldContent) : []),
		...(newContent ? extractPreviewUrls(newContent) : []),
	])

	// Invalidate link preview cache entries
	await Promise.all(
		Array.from(urls).map((u) => cache.delete?.(`link-preview:${u}`)),
	)

	// Invalidate internal link preview cache entries for this slug
	const slugs = new Set<string>()
	if (oldSlug) slugs.add(oldSlug)
	if (newSlug) slugs.add(newSlug)
	await Promise.all(
		Array.from(slugs).map((slug) => cache.delete?.(internalPreviewCacheKey(slug))),
	)

	// Invalidate prior compiled MDX if available
	if (oldContent) {
		await cache.delete?.(mdxCacheKeyFor(oldContent, oldTitle))
	}
}
