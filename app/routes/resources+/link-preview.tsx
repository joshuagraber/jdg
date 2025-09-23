import { cachified, cache } from '#app/utils/cache.server.ts'
import {
	getOpenGraphData,
	hasPreviewData,
	type OpenGraphData,
} from '#app/utils/link-preview.server.ts'
import { type Route } from './+types/link-preview'

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url).searchParams.get('url')
	if (!url) {
		throw new Response('URL parameter is required', { status: 400 })
	}

	try {
		// Basic scheme validation to avoid throwing on new URL(url)
		const isHttp = url.startsWith('http://') || url.startsWith('https://')
		const isData = url.startsWith('data:')
		if (!isHttp && !isData) {
			throw new Response('Invalid URL scheme', { status: 400 })
		}

		const hostname = url.startsWith('data:')
			? 'data-url'
			: new URL(url).hostname
		const fallbackBody = {
			domain: hostname,
			url,
		}
		const MAX_PREVIEW_WAIT_MS = 2500
		const ogPromise = cachified<OpenGraphData>({
			key: `link-preview:${url}`,
			cache,
			ttl: 1000 * 60 * 10, // 10 minutes
			swr: 1000 * 60 * 60 * 24, // 24 hours
			fallbackToCache: 1000 * 60 * 60, // allow fallback to cached value for 1 hour
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
				return result
			},
		})
		let timeoutId: ReturnType<typeof setTimeout> | null = null
		const result = await Promise.race([
			ogPromise.then((data) => ({ status: 'success' as const, data })),
			new Promise<{ status: 'timeout' }>((resolve) => {
				timeoutId = setTimeout(() => resolve({ status: 'timeout' }), MAX_PREVIEW_WAIT_MS)
			}),
		])
		if (timeoutId) clearTimeout(timeoutId)
		if (result.status === 'success') {
			const body = {
				...result.data,
				domain: hostname,
				url,
			}
			return Response.json(body, {
				headers: { 'Cache-Control': 'public, max-age=600' },
			})
		}
		void ogPromise.catch((error) => {
			console.warn('Background link preview fetch failed (resource route)', {
				url,
				error,
			})
		})
		return Response.json(fallbackBody, {
			headers: { 'Cache-Control': 'public, max-age=120' },
			status: 200,
		})
	} catch (error) {
		console.error('Failed to fetch metadata for link preview', { url }, error)
		const domain = url.startsWith('data:') ? 'data-url' : new URL(url).hostname
		return Response.json(
			{ url, domain },
			{
				headers: { 'Cache-Control': 'public, max-age=120' },
				status: 200,
			},
		)
	}
}
