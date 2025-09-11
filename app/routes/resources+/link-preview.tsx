import { cachified, cache } from '#app/utils/cache.server.ts'
import { getOpenGraphData } from '#app/utils/link-preview.server'
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

		const ogData = await cachified({
			key: `link-preview:${url}`,
			cache,
			ttl: 1000 * 60 * 10, // 10 minutes
			swr: 1000 * 60 * 60 * 24, // 24 hours
			async getFreshValue(context) {
				const result = await getOpenGraphData(url)
				// If we failed to fetch useful data, expire immediately to retry soon
				if (!result.title && !result.description && !result.image) {
					context.metadata.ttl = 0
				}
				return result
			},
		})
		const body = {
			...ogData,
			domain: url.startsWith('data:') ? 'data-url' : new URL(url).hostname,
			url,
		}
		return Response.json(body, {
			headers: { 'Cache-Control': 'public, max-age=600' },
		})
	} catch (error) {
		console.error('Failed to fetch metadata:', error)
		throw new Response('Failed to fetch metadata', { status: 500 })
	}
}
