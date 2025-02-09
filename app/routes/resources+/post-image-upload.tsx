import { invariantResponse } from '@epic-web/invariant'
import { LocalFileStorage } from '@mjackson/file-storage/local'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import { data, type ActionFunctionArgs } from '@remix-run/node'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { fileToBlob } from '#app/utils/post-images.server'

const MAX_UPLOAD_SIZE = 1024 * 1024 * 5 // 5MB

const fileStorage = new LocalFileStorage('.uploads/post-images')

export async function action({ request }: ActionFunctionArgs) {
	await requireUserId(request)

	const uploadHandler = async (fileUpload: FileUpload) => {
		if (fileUpload.fieldName === 'file') {
			const storageKey = `post-image-${Date.now()}-${fileUpload.name}`
			await fileStorage.set(storageKey, fileUpload)
			return fileStorage.get(storageKey)
		}
	}

	const formData = await parseFormData(
		request,
		{
			maxFileSize: MAX_UPLOAD_SIZE,
		},
		uploadHandler,
	)

	const file = formData.get('file') as File
	const postId = formData.get('postId') as string | null

	invariantResponse(file, 'No file provided', { status: 404 })

	try {
		const imageData = await fileToBlob({ file })

		const image = await prisma.postImage.create({
			data: {
				...imageData,
				// Only include postId if it exists
				...(postId ? { posts: { connect: { id: postId } } } : {}),
			},
		})

		return getPostImageSource(image.id)
	} catch {
		return data({ error: 'Error uploading image' }, { status: 500 })
	}
}
