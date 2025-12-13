const windowStores = new Map<string, { count: number; expiresAt: number }>()

interface RateLimitOptions {
	windowMs?: number
	max?: number
}

const DEFAULT_WINDOW_MS = 1000 * 60 * 15 // 15 minutes
const DEFAULT_MAX = 5

export function assertRateLimit(
	key: string,
	{ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX }: RateLimitOptions = {},
) {
	if (!key) {
		return
	}
	const now = Date.now()
	const entry = windowStores.get(key)
	if (!entry || entry.expiresAt <= now) {
		windowStores.set(key, { count: 1, expiresAt: now + windowMs })
		return
	}
	if (entry.count >= max) {
		throw new Response('Too many requests. Please try again later.', {
			status: 429,
		})
	}
	entry.count += 1
}
