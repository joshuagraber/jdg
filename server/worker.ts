import { setTimeout as delay } from 'node:timers/promises'
import { getHomeLinkUrls } from '#app/utils/home-links.server.ts'
import { refreshLinkPreview } from '#app/utils/link-preview.server.ts'
import { openReadWrite } from './cache/sqlite.ts'

const DEFAULT_LOOP_DELAY_MS = 1000 * 60 * 5
const DEFAULT_STARTUP_STAGGER_MS = 750

const loopDelay =
	Number.parseInt(process.env.LINK_PREVIEW_REFRESH_INTERVAL_MS ?? '', 10) ||
	DEFAULT_LOOP_DELAY_MS
const startupStagger =
	Number.parseInt(
		process.env.LINK_PREVIEW_REFRESH_STARTUP_DELAY_MS ?? '',
		10,
	) || DEFAULT_STARTUP_STAGGER_MS

let active = true

async function ensureDatabaseReady() {
	const db = openReadWrite()
	db.close()
}

async function refreshConfiguredHomeLinks() {
	const homeLinkUrls = await getHomeLinkUrls()
	for (const url of homeLinkUrls) {
		if (!active) break
		try {
			const result = await refreshLinkPreview(url)
			if (result.status === 'skipped') continue
			if (result.status === 'updated') {
				console.info('Link preview refreshed', {
					url,
					source: result.source,
				})
			}
		} catch (error) {
			console.warn('Link preview refresh failed', { url, error })
		}
	}
}

async function run() {
	await ensureDatabaseReady()
	if (startupStagger > 0) {
		await delay(startupStagger)
	}
	while (active) {
		await refreshConfiguredHomeLinks()
		if (!active) break
		await delay(loopDelay)
	}
}

process.once('SIGINT', () => {
	active = false
})
process.once('SIGTERM', () => {
	active = false
})

void run().catch((error) => {
	console.error('Cache refresher worker crashed', error)
	process.exitCode = 1
})
