import { type CacheEntry } from '@epic-web/cachified'
import { parse } from 'node-html-parser'
import { z } from 'zod'
import { cachified, cache } from '#app/utils/cache.server.ts'

const ogSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	image: z.string().url().optional(),
	site_name: z.string().optional(),
	type: z.string().optional(),
	url: z.string().url().optional(),
	'image:alt': z.string().optional(), // If you want to capture image alt text
})

export type OpenGraphData = z.infer<typeof ogSchema>

const DEFAULT_FETCH_TIMEOUT_MS = 5000
const READ_TIMEOUT_MS = 4000
const MAX_FETCH_ATTEMPTS = 1
const RETRY_DELAY_BASE_MS = 500
const LINK_PREVIEW_CACHE_PREFIX = 'link-preview:'
const LINK_PREVIEW_TTL_MS = 1000 * 60 * 10
const LINK_PREVIEW_SWR_MS = 1000 * 60 * 60 * 24
const LINK_PREVIEW_FALLBACK_TO_CACHE_MS = 1000 * 60 * 60
const inFlightPreviewFetches = new Map<string, Promise<OpenGraphData | null>>()

type FallbackablePreview = OpenGraphData & { __fallback?: true }

type CacheFreshness = 'fresh' | 'stale'

interface CachedLinkPreview {
	data: OpenGraphData
	freshness: CacheFreshness
}

const resolveLinkPreviewCacheKey = (url: string) =>
	`${LINK_PREVIEW_CACHE_PREFIX}${url}`

const resolveCacheFreshness = (
	metadata: CacheEntry<unknown>['metadata'] | undefined,
): CacheFreshness => {
	if (!metadata) return 'fresh'
	const ttl = metadata.ttl
	if (typeof ttl !== 'number' || ttl <= 0) return 'fresh'
	const expiresAt = metadata.createdTime + ttl
	return Date.now() > expiresAt ? 'stale' : 'fresh'
}

const getCachedLinkPreview = (url: string): CachedLinkPreview | null => {
	try {
		const entry = cache.get(
			resolveLinkPreviewCacheKey(url),
		) as CacheEntry<unknown> | null
		if (!entry) return null
		if (!hasPreviewData(entry.value)) return null
		return {
			data: entry.value,
			freshness: resolveCacheFreshness(entry.metadata),
		}
	} catch (error) {
		console.warn('Failed to read cached link preview', { url, error })
		return null
	}
}

const createCachifiedOptions = (
	url: string,
): Parameters<typeof cachified<OpenGraphData>>[0] => ({
	key: resolveLinkPreviewCacheKey(url),
	cache,
	ttl: LINK_PREVIEW_TTL_MS,
	swr: LINK_PREVIEW_SWR_MS,
	fallbackToCache: LINK_PREVIEW_FALLBACK_TO_CACHE_MS,
	checkValue(value) {
		return hasPreviewData(value)
			? true
			: 'Link preview missing essential fields'
	},
	async getFreshValue(context) {
		const result = await getOpenGraphData(url)
		if (!hasPreviewData(result)) {
			context.metadata.ttl = 0
			throw new Error('No preview data available')
		}
		if (isFallbackPreview(result)) {
			context.metadata.ttl = 0
			throw new Error('Only fallback preview available')
		}
		return result
	},
})

function ensureLinkPreviewFetch(
	url: string,
	{ forceFresh }: { forceFresh: boolean },
) {
	const cacheKey = resolveLinkPreviewCacheKey(url)
	const existing = inFlightPreviewFetches.get(cacheKey)
	if (existing) return existing

	const fetchPromise = cachified<OpenGraphData>({
		...createCachifiedOptions(url),
		forceFresh,
	})
		.catch((error) => {
			console.warn('Background link preview fetch failed', { url, error })
			return null
		})
		.finally(() => {
			inFlightPreviewFetches.delete(cacheKey)
		})

	inFlightPreviewFetches.set(cacheKey, fetchPromise)
	return fetchPromise
}

type TimedResult<T> =
	| { status: 'success'; value: T }
	| { status: 'timeout' }
	| { status: 'error'; error: unknown }

const settleWithin = async <T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<TimedResult<T>> =>
	new Promise((resolve) => {
		const timeoutId = setTimeout(() => {
			resolve({ status: 'timeout' })
		}, timeoutMs)

		void promise
			.then((value) => {
				clearTimeout(timeoutId)
				resolve({ status: 'success', value })
			})
			.catch((error) => {
				clearTimeout(timeoutId)
				resolve({ status: 'error', error })
			})
	})

export async function getLinkPreviewForRequest(
	url: string,
	{ maxWaitMs = 350 }: { maxWaitMs?: number } = {},
): Promise<{
	data: OpenGraphData | null
	resolvedFrom: 'cache' | 'fresh' | 'pending'
}> {
	const cached = getCachedLinkPreview(url)
	if (cached && cached.freshness === 'fresh') {
		return { data: cached.data, resolvedFrom: 'cache' }
	}

	const shouldForceFresh = !cached || cached.freshness === 'stale'
	const fetchPromise = ensureLinkPreviewFetch(url, {
		forceFresh: shouldForceFresh,
	})

	if (maxWaitMs > 0) {
		const result = await settleWithin(fetchPromise, maxWaitMs)
		if (result.status === 'success' && result.value) {
			return { data: result.value, resolvedFrom: 'fresh' }
		}
	}

	return {
		data: cached?.data ?? null,
		resolvedFrom: cached ? 'cache' : 'pending',
	}
}

export type RefreshResult =
	| { status: 'skipped' }
	| { status: 'updated'; source: 'created' | 'refreshed' }

export async function refreshLinkPreview(url: string): Promise<RefreshResult> {
	const before = getCachedLinkPreview(url)
	const result = await ensureLinkPreviewFetch(url, { forceFresh: true })
	if (!result) {
		return { status: 'skipped' }
	}
	const after = getCachedLinkPreview(url)
	if (!after) {
		return { status: 'skipped' }
	}
	const source = before ? 'refreshed' : 'created'
	return { status: 'updated', source }
}

const fetchWithTimeout = async (
	url: string,
	timeout = DEFAULT_FETCH_TIMEOUT_MS,
) => {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeout)

	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
			},
			signal: controller.signal,
			redirect: 'follow', // explicitly follow redirects
		})

		clearTimeout(timeoutId)
		return response
	} catch (error) {
		clearTimeout(timeoutId)
		throw error
	}
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchHtml(url: string): Promise<string> {
	let lastError: unknown
	for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
		try {
			const response = await fetchWithTimeout(url)
			if (!response.ok) {
				throw new Error(
					`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
				)
			}
			let readTimeoutId: ReturnType<typeof setTimeout> | null = null
			try {
				const readTimeoutPromise = new Promise<string>((_, reject) => {
					readTimeoutId = setTimeout(
						() => reject(new Error('Response body read timeout')),
						READ_TIMEOUT_MS,
					)
				})
				const html = await Promise.race([response.text(), readTimeoutPromise])
				if (readTimeoutId) clearTimeout(readTimeoutId)
				return html as string
			} catch (error) {
				if (readTimeoutId) clearTimeout(readTimeoutId)
				throw error
			}
		} catch (error) {
			lastError = error
			if (attempt < MAX_FETCH_ATTEMPTS) {
				await sleep(RETRY_DELAY_BASE_MS * attempt)
				continue
			}
			throw error
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error('Unknown error fetching HTML')
}

export function hasPreviewData(data: unknown): data is OpenGraphData {
	if (!data || typeof data !== 'object') return false
	const candidate = data as Partial<OpenGraphData>
	const hasTitle =
		typeof candidate.title === 'string' && candidate.title.trim() !== ''
	const hasDescription =
		typeof candidate.description === 'string' &&
		candidate.description.trim() !== ''
	const hasImage =
		typeof candidate.image === 'string' && candidate.image.trim() !== ''
	return hasTitle || hasDescription || hasImage
}

function isAbortError(error: unknown) {
	if (!error) return false
	if (error instanceof DOMException) {
		return error.name === 'AbortError'
	}
	if (error instanceof Error) {
		return error.name === 'AbortError'
	}
	return false
}

function buildFallbackPreview(url: string): OpenGraphData {
	try {
		const parsed = new URL(url)
		const hostname = parsed.hostname || parsed.href
		return {
			title: hostname,
			description: parsed.href,
		} as OpenGraphData
	} catch {
		return { title: url } as OpenGraphData
	}
}

export async function getOpenGraphData(url: string): Promise<OpenGraphData> {
	try {
		let html: string

		if (url.startsWith('data:')) {
			// Handle data URLs
			const base64Data = url.split(',')[1]
			if (!base64Data) {
				throw new Error('Invalid data URL')
			}
			html = Buffer.from(base64Data, 'base64').toString('utf-8')
		} else {
			html = await fetchHtml(url)
		}

		const root = parse(html)
		const ogData: Record<string, string> = {}

		// Process OG tags and other metadata as before
		root.querySelectorAll('meta[property^="og:"]').forEach((meta) => {
			try {
				const property = meta.getAttribute('property')?.replace('og:', '')
				const content = meta.getAttribute('content')
				if (property && content) {
					ogData[property] = content
				}
			} catch (e) {
				console.error('Error processing meta tag:', e)
			}
		})

		// Safely try to get each fallback
		try {
			if (!ogData.title) {
				ogData.title =
					root.querySelector('meta[name="title"]')?.getAttribute('content') ||
					root.querySelector('title')?.textContent ||
					''
			}
		} catch (e) {
			console.error('Error getting title:', e)
		}

		try {
			if (!ogData.description) {
				ogData.description =
					root
						.querySelector('meta[name="description"]')
						?.getAttribute('content') || ''
			}
		} catch (e) {
			console.error('Error getting description:', e)
		}

		try {
			if (!ogData.image) {
				const twitterImage = root
					.querySelector('meta[name="twitter:image"]')
					?.getAttribute('content')
				if (twitterImage) {
					ogData.image = twitterImage
				} else {
					const iconHref = root
						.querySelector('link[rel="icon"], link[rel="shortcut icon"]')
						?.getAttribute('href')
					if (iconHref) {
						try {
							const resolved = new URL(iconHref, url).href
							ogData.image = resolved
						} catch {
							// ignore invalid icon URLs
						}
					}
				}
			}
		} catch (e) {
			console.error('Error getting image:', e)
		}

		try {
			if (!ogData.site_name) {
				ogData.site_name =
					root
						.querySelector('meta[name="application-name"]')
						?.getAttribute('content') ||
					root
						.querySelector('meta[name="site_name"]')
						?.getAttribute('content') ||
					new URL(url).hostname
			}
		} catch (e) {
			console.error('Error getting site name:', e)
		}

		const parsed = ogSchema.parse(ogData)
		const sanitized: OpenGraphData = {}
		if (parsed.title?.trim()) sanitized.title = parsed.title.trim()
		if (parsed.description?.trim())
			sanitized.description = parsed.description.trim()
		if (parsed.image?.trim()) sanitized.image = parsed.image
		if (parsed.site_name?.trim()) sanitized.site_name = parsed.site_name.trim()
		if (parsed.type?.trim()) sanitized.type = parsed.type.trim()
		if (parsed.url?.trim()) sanitized.url = parsed.url
		if (parsed['image:alt']?.trim())
			sanitized['image:alt'] = parsed['image:alt'].trim()
		console.log('Fetched OpenGraph data:', { url, sanitized, parsed, ogData })
		return sanitized
	} catch (e) {
		const fallback = buildFallbackPreview(url) as FallbackablePreview
		fallback.__fallback = true
		if (isAbortError(e)) {
			console.warn('Link preview request timed out', { url })
		} else {
			console.error('Error in getOpenGraphData:', { url }, e)
		}
		return fallback
	}
}

function isFallbackPreview(data: OpenGraphData): data is FallbackablePreview {
	return (data as FallbackablePreview).__fallback === true
}
