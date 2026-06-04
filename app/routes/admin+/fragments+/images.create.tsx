import { LocalFileStorage } from '@mjackson/file-storage/local'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import { MaxFileSizeExceededError } from '@mjackson/multipart-parser'
import { data } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server'
import {
	getImageDimensions,
	processPostImage,
} from '#app/utils/image-processing.server.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'
import {
	getSignedUploadUrl,
	IMMUTABLE_CACHE_CONTROL,
} from '#app/utils/s3.server.ts'
import { type Route } from './+types/images.create'

const MAX_RAW_UPLOAD_SIZE = 1024 * 1024 * 75 // 75MB
const MAX_PROCESSED_IMAGE_SIZE = 1024 * 1024 * 10 // 10MB
const fileStorage = new LocalFileStorage('.uploads/post-images')

class ProcessedImageTooLargeError extends Error {
	constructor() {
		super('Processed image is too large')
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserId(request)

	const uploadHandler = async (fileUpload: FileUpload) => {
		const storageKey = `post-image-${Date.now()}-${fileUpload.name}`

		if (fileUpload.fieldName === 'file') {
			const inputBuffer = Buffer.from(await fileUpload.arrayBuffer())
			const processedImage = await processPostImage(
				inputBuffer,
				fileUpload.name,
			)
			if (processedImage.buffer.byteLength > MAX_PROCESSED_IMAGE_SIZE) {
				throw new ProcessedImageTooLargeError()
			}

			const processedFile = new File(
				[processedImage.buffer],
				processedImage.fileName,
				{
					type: processedImage.contentType,
				},
			)

			await fileStorage.set(storageKey, processedFile)
			return fileStorage.get(storageKey)
		}
	}

	let formData: FormData
	try {
		formData = await parseFormData(
			request,
			{
				maxFileSize: MAX_RAW_UPLOAD_SIZE,
			},
			uploadHandler,
		)
	} catch (error) {
		if (error instanceof MaxFileSizeExceededError) {
			return data(
				{ error: 'Image upload is too large to process' },
				{ status: 413 },
			)
		}
		if (error instanceof ProcessedImageTooLargeError) {
			return data(
				{ error: 'Image is still too large after processing' },
				{ status: 413 },
			)
		}
		return data({ error: 'Error processing image' }, { status: 400 })
	}

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
		const key = `images/${Date.now()}-${file.name}`
		const uploadUrl = await getSignedUploadUrl(key, file.type)

		// Determine dimensions of the processed WebP file we will upload.
		const arrayBuf = await file.arrayBuffer()
		const { width, height } = await getImageDimensions(Buffer.from(arrayBuf))

		const image = await prisma.postImage.create({
			data: {
				s3Key: key,
				contentType: file.type,
				altText,
				title,
				width: width ?? null,
				height: height ?? null,
			},
		})

		if (image) {
			await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: {
					'Content-Type': file.type,
					'Cache-Control': IMMUTABLE_CACHE_CONTROL,
				},
			})
		}

		return (
			getPostImageSource(image.id, { s3Key: image.s3Key }) ??
			getPostImageSource(image.id, { relative: true }) ??
			`/resources/post-images/${image.id}`
		)
	} catch {
		return data({ error: 'Error uploading image' }, { status: 500 })
	}
}
