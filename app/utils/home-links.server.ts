import { prisma } from '#app/utils/db.server.ts'
import { getLinkPreviewForRequest } from '#app/utils/link-preview.server.ts'

export const HOME_LINK_SECTIONS = ['writing', 'editing', 'software'] as const

export type HomeLinkSection = (typeof HOME_LINK_SECTIONS)[number]

export async function getHomeLinkUrls(
	section?: HomeLinkSection,
): Promise<string[]> {
	const links = await prisma.homeLink.findMany({
		where: section ? { section } : undefined,
		select: { url: true },
		orderBy: section
			? [{ position: 'asc' }, { createdAt: 'desc' }]
			: [{ section: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
	})

	return links.map((link) => link.url)
}

export interface HomeLinkPreview {
	url: string
	title?: string
	description?: string
	image?: string
	domain?: string
}

export async function getHomeLinkPreviews(
	urls: string[],
	{ maxWaitMs = 0 }: { maxWaitMs?: number } = {},
): Promise<Array<HomeLinkPreview>> {
	return Promise.all(
		urls.map(async (url) => {
			let domain: string | undefined
			try {
				domain = url.startsWith('data:') ? 'data-url' : new URL(url).hostname
			} catch {
				domain = undefined
			}
			const fallbackPreview: HomeLinkPreview = {
				url,
				title: undefined,
				description: undefined,
				image: undefined,
				domain,
			}

			const { data, resolvedFrom } = await getLinkPreviewForRequest(url, {
				maxWaitMs,
			})

			if (!data) {
				if (resolvedFrom === 'pending') {
					console.debug('Link preview pending; using fallback', { url })
				}
				return fallbackPreview
			}

			return {
				url,
				title: data.title,
				description: data.description,
				image: data.image,
				domain,
			}
		}),
	)
}
