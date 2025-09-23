import { type LoaderFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { getPostImageSource } from '#app/utils/misc.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)

	const images = await prisma.postImage.findMany({
		select: {
			id: true,
			altText: true,
			createdAt: true,
			contentType: true,
			s3Key: true,
		},
		orderBy: {
			createdAt: 'desc',
		},
	})

	// Don't return the actual blob data in the list
	// Instead, the client can use the id to fetch individual images
	// through the existing /resources/post-images/$imageId route
	return {
		images: images.map((image) => ({
			...image,
			url: getPostImageSource(image.id, { s3Key: image.s3Key }),
		})),
	}
}
