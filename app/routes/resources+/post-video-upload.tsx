import { invariantResponse } from '@epic-web/invariant'
import { LocalFileStorage } from '@mjackson/file-storage/local'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import { data } from 'react-router'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { getPostVideoSource } from '#app/utils/misc.tsx'
import { fileToBlob } from '#app/utils/post-images.server'
import { getSignedUploadUrl } from '#app/utils/s3.server.ts'
import { type Route } from './+types/post-video-upload'

const MAX_UPLOAD_SIZE = 1024 * 1024 * 50 // 50MB

const fileStorage = new LocalFileStorage('.uploads/post-videos')

export async function action({ request }: Route.ActionArgs) {
	await requireUserId(request)

	let storageKey
	const uploadHandler = async (fileUpload: FileUpload) => {
		if (fileUpload.fieldName === 'file') {
			storageKey = `post-video-${Date.now()}-${fileUpload.name}`
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
		const key = `videos/${Date.now()}-${file.name}`
		const uploadUrl = await getSignedUploadUrl(key, file.type)
		
		const video = await prisma.postVideo.create({
			data: {
				s3Key: key,
				contentType: file.type,
			},
		})

		if (video) {      
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })
		}

		
		return data({ uploadUrl, id: video.id })
		} catch {
		return data({ error: 'Error uploading video' }, { status: 500 })
	} finally {
		try {
			if (storageKey) await fileStorage.remove(storageKey)
		} catch (e) {
			console.error('Error removing file from storage', { e })
		}
	}
}
