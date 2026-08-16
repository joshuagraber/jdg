import { expect, test } from 'vitest'
import { buildAssetUrlFromKey, decodeUrlForLog } from './url.ts'

test('decodeUrlForLog decodes valid URLs', () => {
	expect(decodeUrlForLog('/fragments/a%20b')).toBe('/fragments/a b')
})

test('decodeUrlForLog leaves malformed URLs unchanged', () => {
	expect(decodeUrlForLog('/%E0%A4%A')).toBe('/%E0%A4%A')
	expect(decodeUrlForLog('/bad%')).toBe('/bad%')
})

test('decodeUrlForLog handles missing URLs', () => {
	expect(decodeUrlForLog(null)).toBe('')
	expect(decodeUrlForLog(undefined)).toBe('')
})

test('buildAssetUrlFromKey encodes S3 key path segments for headers', () => {
	const location = buildAssetUrlFromKey(
		'https://cdn.example.com/',
		'/images/1744597593441-Screenshot 2025-04-13 at 10.25.59 PM.webp',
	)

	expect(location).toBe(
		'https://cdn.example.com/images/1744597593441-Screenshot%202025-04-13%20at%2010.25.59%E2%80%AFPM.webp',
	)
	expect(() => new Headers({ Location: location ?? '' })).not.toThrow()
})

test('buildAssetUrlFromKey returns null when missing base or key', () => {
	expect(buildAssetUrlFromKey(null, 'images/a.png')).toBeNull()
	expect(buildAssetUrlFromKey('https://cdn.example.com', null)).toBeNull()
})
