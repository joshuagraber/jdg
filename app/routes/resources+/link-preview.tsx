import { getLinkPreviewForRequest } from '#app/utils/link-preview.server.ts'
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
		const { data, resolvedFrom } = await getLinkPreviewForRequest(url, {
			maxWaitMs: 500,
		})
		if (data) {
			const body = {
				url,
				domain: hostname,
				title: data.title,
				description: data.description,
				image: data.image,
			}
			return Response.json(body, {
				headers: { 'Cache-Control': 'public, max-age=600' },
			})
		}
		if (resolvedFrom === 'pending') {
			console.debug('Link preview pending; using fallback (resource route)', {
				url,
			})
		}
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
