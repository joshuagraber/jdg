import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { getPostVideoSource } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { fileToBlob } from '#app/utils/post-images.server'
import { getSignedUploadUrl } from '#app/utils/s3.server.ts'
import { type Route } from './+types/videos.create'

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()

	const file = formData.get('file') as File | null
	if (!file) {
		return data({ error: 'File is required' }, { status: 400 })
	}

	const altText = formData.get('altText') as string | null
	const title = formData.get('title') as string | null

	try {
		const key = `videos/${Date.now()}-${file.name}`
		const uploadUrl = await getSignedUploadUrl(key, file.type)

		const video = await prisma.postVideo.create({
			data: {
				s3Key: key,
				contentType: file.type,
				altText,
				title,
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

		return getPostVideoSource(video.id)
	} catch (error) {
		return data(
			{ error: 'Error uploading video', details: error },
			{ status: 500 },
		)
	}
}
