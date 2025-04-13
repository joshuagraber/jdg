import { invariantResponse } from '@epic-web/invariant'
import { LocalFileStorage } from '@mjackson/file-storage/local'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import { data, type ActionFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { fileToBlob } from '#app/utils/post-images.server'
import { getSignedUploadUrl } from '#app/utils/s3.server'
import { type Route } from './+types/post-image-upload'


const MAX_UPLOAD_SIZE = 1024 * 1024 * 5 // 5MB

const fileStorage = new LocalFileStorage('.uploads/post-images')

export async function action({ request }: Route.ActionArgs) {
	await requireUserId(request)

	let storageKey
	const uploadHandler = async (fileUpload: FileUpload) => {
		if (fileUpload.fieldName === 'file') {
			storageKey = `post-image-${Date.now()}-${fileUpload.name}`
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

	invariantResponse(file, 'No file provided', { status: 404 })

	try {
		const key = `images/${Date.now()}-${file.name}`
		const uploadUrl = await getSignedUploadUrl(key, file.type)
		
		const image = await prisma.postImage.create({
			data: { 
				s3Key: key,
				contentType: file.type,
				altText: formData.get('altText') as string,
				title: formData.get('title') as string
			},
		})

		if (image) {      
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })
		}

		return data({ id: image.id })
		} catch {
		return data({ error: 'Error uploading image' }, { status: 500 })
	} finally {
		// Clean up storage. We clear it on new builds anyway, so this is okay to go in 'finally' and swallow any error.
		try {
			if (storageKey) await fileStorage.remove(storageKey)
		} catch (e) {
			console.error('Error removing file from storage', { e })
		}
	}
}
