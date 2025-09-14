import * as fs from 'node:fs'
import sourceMapSupport from 'source-map-support'

sourceMapSupport.install({
	retrieveSourceMap: function (source) {
		// get source file without the `file://` prefix or `?t=...` suffix
		const match = source.match(/^file:\/\/(.*)\?t=[.\d]+$/)
		if (match) {
			return {
				url: source,
				map: fs.readFileSync(`${match[1]}.map`, 'utf8'),
			}
		}
		return null
	},
})

// Load .env early in non-production environments. On Fly, use real env vars.
if (process.env.NODE_ENV !== 'production') {
    try {
        await import('dotenv/config')
    } catch {
        // ignore if dotenv is not installed
    }
}

// In production, ensure INTERNAL_COMMAND_TOKEN is available. Dockerfile writes it to /myapp/.env.
if (
    process.env.NODE_ENV === 'production' &&
    !process.env.INTERNAL_COMMAND_TOKEN
) {
    try {
        const envPath = new URL('./.env', import.meta.url)
        const raw = fs.readFileSync(envPath, 'utf8')
        for (const line of raw.split('\n')) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
            if (!m) continue
            const key = m[1]
            let val = m[2]
            val = val.replace(/^['"]|['"]$/g, '')
            if (!(key in process.env)) process.env[key] = val
        }
    } catch {
        // ignore if file missing
    }
}

if (process.env.MOCKS === 'true') {
	await import('./tests/mocks/index.ts')
}

if (process.env.NODE_ENV === 'production') {
	await import('./server-build/index.js')
} else {
	await import('./server/index.ts')
}
