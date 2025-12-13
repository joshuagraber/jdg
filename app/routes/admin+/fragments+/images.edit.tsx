import { invariantResponse } from '@epic-web/invariant'
import { data, type ActionFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'

export async function action({ request }: ActionFunctionArgs) {
	await requireUserId(request)
	const formData = await request.formData()

	const imageId = formData.get('imageId')

	// Alt text and title are optional, since we can set them to whatever we want on the client
	const altText = (formData.get('altText') as string) ?? ''
	const title = (formData.get('title') as string) ?? ''

	invariantResponse(typeof imageId === 'string', 'Invalid request', {
		status: 400,
	})

	const updatedImage = await prisma.postImage.update({
		where: { id: imageId },
		data: { altText, title },
	})

	return data(
		{ success: true, image: updatedImage },
		{
			status: 200,
		},
	)
}
