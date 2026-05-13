import { type ServerBuild } from 'react-router'
import {
	type RobotsConfig,
	type RobotsPolicy,
	type SEOHandle,
	type SEOOptions,
	type SitemapEntry,
} from '#app/utils/seo.ts'

const DEFAULT_ROBOTS_POLICIES: RobotsPolicy[] = [
	{ type: 'userAgent', value: '*' },
	{ type: 'allow', value: '/' },
]

const ROBOTS_LINE_BY_TYPE: Record<RobotsPolicy['type'], string> = {
	allow: 'Allow',
	crawlDelay: 'Crawl-delay',
	disallow: 'Disallow',
	sitemap: 'Sitemap',
	userAgent: 'User-agent',
}

function removeTrailingSlash(value: string) {
	return value.endsWith('/') ? value.slice(0, -1) : value
}

function createTextResponse(
	body: string,
	contentType: 'application/xml' | 'text/plain',
	headers?: HeadersInit,
) {
	const bytes = new TextEncoder().encode(body).byteLength
	return new Response(body, {
		headers: {
			...headers,
			'Content-Length': String(bytes),
			'Content-Type': contentType,
		},
	})
}

function getRobotsText(policies: RobotsPolicy[]) {
	return policies
		.map((policy) => `${ROBOTS_LINE_BY_TYPE[policy.type]}: ${policy.value}`)
		.join('\n')
		.concat('\n')
}

function typedBoolean<T>(
	value: T,
): value is Exclude<T, '' | 0 | false | null | undefined> {
	return Boolean(value)
}

function isSameSitemapEntry(a: SitemapEntry, b: SitemapEntry) {
	return (
		a.route === b.route &&
		a.lastmod === b.lastmod &&
		a.changefreq === b.changefreq &&
		a.priority === b.priority
	)
}

function buildSitemapUrlEntry(siteUrl: string, entry: SitemapEntry) {
	return `
  <url>
    <loc>${siteUrl}${entry.route}</loc>
    ${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}
    ${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ''}
    ${typeof entry.priority === 'number' ? `<priority>${entry.priority}</priority>` : ''}
  </url>
	`.trim()
}

async function getSitemapXml(
	request: Request,
	routes: ServerBuild['routes'],
	options: Pick<SEOOptions, 'siteUrl'>,
) {
	const rawSitemapEntries = (
		await Promise.all(
			Object.entries(routes).map(async ([id, route]) => {
				if (id === 'root') return
				if (!route) return

				const handle = route.module.handle as SEOHandle | undefined
				if (handle?.getSitemapEntries) {
					return handle.getSitemapEntries(request)
				}

				if (!('default' in route.module)) return

				let parentId = route.parentId
				let parent = parentId ? routes[parentId] : null

				let path: string | undefined
				if (route.path) {
					path = removeTrailingSlash(route.path)
				} else if (route.index) {
					path = ''
				} else {
					return
				}

				while (parent) {
					const parentPath = parent.path ? removeTrailingSlash(parent.path) : ''
					path = `${parentPath}/${path}`
					parentId = parent.parentId
					parent = parentId ? routes[parentId] : null
				}

				if (path == null || path.includes(':')) return
				return { route: removeTrailingSlash(path) }
			}),
		)
	)
		.flatMap((entry) => entry)
		.filter(typedBoolean)

	const sitemapEntries: Array<SitemapEntry> = []
	for (const entry of rawSitemapEntries) {
		const existingEntry = sitemapEntries.find(
			(item) => item.route === entry.route,
		)
		if (existingEntry) {
			if (!isSameSitemapEntry(existingEntry, entry)) {
				console.warn(
					`Duplicate route for ${entry.route} with different sitemap data`,
					{ entry, existingEntry },
				)
			}
			continue
		}
		sitemapEntries.push(entry)
	}

	return `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
  >
    ${sitemapEntries
			.map((entry) => buildSitemapUrlEntry(options.siteUrl, entry))
			.join('')}
  </urlset>
	`.trim()
}

export async function generateRobotsTxt(
	policies: RobotsPolicy[] = [],
	{ appendOnDefaultPolicies = true, headers }: RobotsConfig = {},
) {
	const policiesToUse = appendOnDefaultPolicies
		? [...DEFAULT_ROBOTS_POLICIES, ...policies]
		: policies
	return createTextResponse(getRobotsText(policiesToUse), 'text/plain', headers)
}

export async function generateSitemap(
	request: Request,
	routes: ServerBuild['routes'],
	options: SEOOptions,
) {
	const sitemap = await getSitemapXml(request, routes, options)
	return createTextResponse(sitemap, 'application/xml', options.headers)
}
