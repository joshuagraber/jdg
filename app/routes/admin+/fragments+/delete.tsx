import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { invalidatePostCaches } from '#app/utils/preview-utils.server.ts'

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData()
    const id = formData.get('postId')

	invariantResponse(typeof id === 'string', 'Invalid request', { status: 400 })

    const existing = await prisma.post.findUnique({ where: { id } })
    const deleted = await prisma.post.delete({ where: { id } })

    invariantResponse(deleted, 'Not found', { status: 404 })

    // Invalidate caches related to this post
    await invalidatePostCaches(existing?.content ?? undefined, undefined, existing?.title ?? undefined)

    return deleted
}
