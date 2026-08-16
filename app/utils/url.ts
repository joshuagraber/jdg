export function decodeUrlForLog(rawUrl?: string | null) {
	if (!rawUrl) return ''
	try {
		return decodeURIComponent(rawUrl)
	} catch {
		return rawUrl
	}
}

export function buildAssetUrlFromKey(
	assetBase: string | null | undefined,
	key: string | null | undefined,
) {
	const base = assetBase?.trim().replace(/\/$/, '')
	const rawKey = key?.replace(/^\/+/, '')
	if (!base || !rawKey) return null

	const encodedKey = rawKey
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')

	return `${base}/${encodedKey}`
}
