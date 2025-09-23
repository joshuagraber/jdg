const IP_HEADER_CANDIDATES = [
	'cf-connecting-ip',
	'x-forwarded-for',
	'fly-client-ip',
	'x-real-ip',
	'forwarded',
]

export function getClientIPAddress(request: Request): string | null {
	for (const header of IP_HEADER_CANDIDATES) {
		const value = request.headers.get(header)
		if (!value) continue
		if (header.toLowerCase() === 'forwarded') {
			const match = /for="?([^;\s"]+)"?/i.exec(value)
			if (match?.[1]) return match[1]
			continue
		}
		const parts = value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean)
		if (parts.length > 0) return parts[0]
	}
	const remoteAddress = (request as any).socket?.remoteAddress ?? null
	return remoteAddress ?? null
}
