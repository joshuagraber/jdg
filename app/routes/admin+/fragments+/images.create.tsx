import { LocalFileStorage } from '@mjackson/file-storage/local'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import { data } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server'
import { resizeImage } from '#app/utils/image-processing.server.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { fileToBlob } from '#app/utils/post-images.server'
import { type Route } from './+types/images.create'

const MAX_UPLOAD_SIZE = 1024 * 1024 * 10 // 10MB
const fileStorage = new LocalFileStorage('.uploads/post-images')

export async function action({ request }: Route.ActionArgs) {
	await requireUserId(request)

	const uploadHandler = async (fileUpload: FileUpload) => {
		const storageKey = `post-image-${Date.now()}-${fileUpload.name}`

		// If a GIF, skip the processing
		if (fileUpload.type === 'image/gif') {
			await fileStorage.set(storageKey, fileUpload)
			return fileStorage.get(storageKey)
		}

		if (fileUpload.fieldName === 'file') {
			// Convert upload to buffer for processing
			const buffer = await fileUpload.arrayBuffer()
			// Resize to max 800px (post container max width)
			const resizedImageBuffer = await resizeImage(Buffer.from(buffer))

			// Create a new File object with the resized image
			const resizedFile = new File([resizedImageBuffer], fileUpload.name, {
				type: fileUpload.type,
			})

			await fileStorage.set(storageKey, resizedFile)
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

	const file = formData.get('file') as File | null
	const altText = formData.get('altText') as string | null
	const title = formData.get('title') as string | null

	if (!(file instanceof File && file.size)) {
		return data({ error: 'No file to upload' }, { status: 400 })
	}
	if (!altText) {
		return data({ error: 'Alt text is required' }, { status: 400 })
	}

	try {
		const imageData = await fileToBlob({ file, altText, title })

		const image = await prisma.postImage.create({
			data: {
				...imageData,
			},
		})

		return getPostImageSource(image.id)
	} catch {
		return data({ error: 'Error uploading image' }, { status: 500 })
	}
}
