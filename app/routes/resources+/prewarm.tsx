import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { compileMDX } from '#app/utils/mdx.server'

export async function loader({ request }: { request: Request }) {
  const auth = request.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.INTERNAL_COMMAND_TOKEN}`
  if (!process.env.INTERNAL_COMMAND_TOKEN || auth !== expected) {
    return new Response('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const target = url.searchParams.get('target') || 'fragments'

  const start = Date.now()
  let compiled = 0
  let total = 0
  if (target === 'fragments') {
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
      Array.from({ length: Math.min(concurrency, posts.length) }, () => worker()),
    )
  }

  const ms = Date.now() - start
  return data({ target, compiled, total, ms })
}
