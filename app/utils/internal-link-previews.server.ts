import { matchPath } from 'react-router'
import { handle as wheelPoemHandle } from '#app/routes/experiments.wheel-poem'
import { handle as fragmentSlugHandle } from '#app/routes/fragments+/$slug'
import { handle as fragmentsIndexHandle } from '#app/routes/fragments+/_index'
import {
	type InternalLinkPreviewData,
	type LinkPreviewHandle,
} from './link-preview'

const linkPreviewRoutes: Array<{ path: string; handle: LinkPreviewHandle }> = [
	{ path: '/fragments/:slug', handle: fragmentSlugHandle },
	{ path: '/fragments', handle: fragmentsIndexHandle },
	{ path: '/experiments/wheel-poem', handle: wheelPoemHandle },
]

export async function getInternalLinkPreview(
	path: string,
	request: Request,
): Promise<InternalLinkPreviewData | null> {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`

	for (const route of linkPreviewRoutes) {
		const match = matchPath({ path: route.path, end: true }, normalizedPath)
		if (!match) continue
		const resolver = route.handle.linkPreview
		if (!resolver) continue
		const result = await resolver({ params: match.params, request })
		if (!result) continue
		const url = result.url ?? normalizedPath
		const isInternal = url.startsWith('/')
		let domain = result.domain ?? null
		if (!isInternal && !domain) {
			try {
				domain = new URL(url).hostname
			} catch {
				domain = null
			}
		}
		return {
			...result,
			url,
			domain,
		}
	}

	return null
}

export async function getInternalLinkPreviews(
	paths: Array<string>,
	request: Request,
): Promise<Record<string, InternalLinkPreviewData>> {
	const uniquePaths = Array.from(
		new Set(paths.map((path) => (path.startsWith('/') ? path : `/${path}`))),
	)
	const entries = await Promise.all(
		uniquePaths.map(async (path) => {
			const preview = await getInternalLinkPreview(path, request)
			return preview ? ([path, preview] as const) : null
		}),
	)

	return Object.fromEntries(
		entries.filter(Boolean) as Array<[string, InternalLinkPreviewData]>,
	)
}
