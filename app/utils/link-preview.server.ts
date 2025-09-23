import { parse } from 'node-html-parser'
import { z } from 'zod'

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

const DEFAULT_FETCH_TIMEOUT_MS = 15000
const READ_TIMEOUT_MS = 10000
const MAX_FETCH_ATTEMPTS = 2
const RETRY_DELAY_BASE_MS = 500

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
	const hasTitle = typeof candidate.title === 'string' && candidate.title.trim() !== ''
	const hasDescription =
		typeof candidate.description === 'string' &&
		candidate.description.trim() !== ''
	const hasImage =
		typeof candidate.image === 'string' && candidate.image.trim() !== ''
	return hasTitle || hasDescription || hasImage
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
				ogData.image =
					root
						.querySelector('meta[name="twitter:image"]')
						?.getAttribute('content') ||
					root.querySelector('img[src^="http"]')?.getAttribute('src') ||
					''
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
		return sanitized
	} catch (e) {
		console.error('Error in getOpenGraphData:', { url }, e)
		return {}
	}
}
