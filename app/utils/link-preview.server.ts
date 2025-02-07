import { parse } from 'node-html-parser'
import { z } from 'zod'

const ogSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	image: z.string().url().optional(),
	site_name: z.string().optional(),
})

export type OpenGraphData = z.infer<typeof ogSchema>

export async function getOpenGraphData(url: string): Promise<OpenGraphData> {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'bot',
			},
		})

		if (!response.ok) {
			console.error(`Failed to fetch ${url}: ${response.status}`)
			return {}
		}

		const html = await response.text()
		const root = parse(html)
		const ogData: Record<string, string> = {}

		try {
			// First try OG tags
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
		} catch (e) {
			console.error('Error processing HTML:', e)
		}

		return ogSchema.parse(ogData)
	} catch (e) {
		console.error('Error in getOpenGraphData:', e)
		return {}
	}
}
