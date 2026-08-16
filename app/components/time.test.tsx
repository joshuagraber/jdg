import { renderToString } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Time } from './time.tsx'

test('Time renders stable empty fallback on the server', () => {
	const html = renderToString(
		<Time time="2026-08-16T12:34:56.000Z" className="text-sm" />,
	)

	expect(html).toContain('dateTime="2026-08-16T12:34:56.000Z"')
	expect(html).toContain('class="text-sm"')
	expect(html).not.toContain('August')
	expect(html).not.toContain('2026</time>')
})

test('Time preserves Date values as ISO dateTime on the server', () => {
	const html = renderToString(<Time time={new Date('2026-08-16T12:34:56Z')} />)

	expect(html).toContain('dateTime="2026-08-16T12:34:56.000Z"')
})
