import { data } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { compileMDX } from '#app/utils/mdx.server.ts'
import { type Route } from './+types/preview'

export async function action({ request }: Route.ActionArgs) {
	await requireUserId(request)
	const formData = await request.formData()
	const markdown = formData.get('markdown')

	if (typeof markdown !== 'string') {
		return data(
			{ status: 'error', message: 'Missing markdown' } as const,
			{ status: 400 },
		)
	}

	try {
		const result = await compileMDX(markdown, { title: 'preview' })
		return data({ status: 'success', code: result.code } as const)
	} catch (error) {
		return data(
			{
				status: 'error',
				message:
					error instanceof Error ? error.message : 'Unable to render preview',
			} as const,
			{ status: 400 },
		)
	}
}
