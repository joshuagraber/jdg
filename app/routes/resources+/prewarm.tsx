import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { compileMDX } from '#app/utils/mdx.server'
import { RECENT_PUBLICATIONS } from '#app/routes/index.tsx'

export async function loader({ request }: { request: Request }) {
	const auth = request.headers.get('authorization') || ''
	const expected = `Bearer ${process.env.INTERNAL_COMMAND_TOKEN}`
	if (!process.env.INTERNAL_COMMAND_TOKEN || auth !== expected) {
		return new Response('Forbidden', { status: 403 })
	}

	const reqUrl = new URL(request.url)
	const targetParam = reqUrl.searchParams.get('target') || 'fragments'
	const targets = new Set(targetParam.split(',').map((t) => t.trim()))

	const start = Date.now()
	let compiled = 0
	let total = 0
	if (targets.has('fragments')) {
		const posts = await prisma.post.findMany({
			where: { publishAt: { not: null } },
			select: { id: true, slug: true, content: true },
			orderBy: { publishAt: 'desc' },
		})
		total = posts.length
		const concurrency = 2
		let index = 0

		const worker = async () => {
			// Use an index snapshot per iteration to keep types happy
			while (true) {
				const i = index++
				if (i >= posts.length) break
				const current = posts[i]!
				try {
					await compileMDX(current.content)
					compiled++
				} catch (e) {
					// swallow; prewarm shouldn't fail the app
					// console.warn('prewarm error', current.slug, e)
				}
			}
		}
		await Promise.all(
			Array.from({ length: Math.min(concurrency, posts.length) }, () =>
				worker(),
			),
		)
	}

	// Also warm homepage link previews if requested, by calling our own route
	let previews = 0
	let previewsTotal = 0
	if (targets.has('link-previews')) {
		previewsTotal = RECENT_PUBLICATIONS.length
		const origin = reqUrl.origin
		const concurrency = 2
		let idx = 0
		const worker = async () => {
			while (true) {
				const i = idx++
				if (i >= RECENT_PUBLICATIONS.length) break
				const link = RECENT_PUBLICATIONS[i]!
				try {
					const res = await fetch(
						`${origin}/resources/link-preview?url=${encodeURIComponent(link)}`,
						{ headers: { Accept: 'application/json' } },
					)
					if (res.ok) previews++
				} catch {
					// ignore
				}
			}
		}
		await Promise.all(
			Array.from(
				{ length: Math.min(concurrency, RECENT_PUBLICATIONS.length) },
				() => worker(),
			),
		)
	}

	const ms = Date.now() - start
	return data({
		targets: Array.from(targets),
		compiled,
		total,
		previews,
		previewsTotal,
		ms,
	})
}
