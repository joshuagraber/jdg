import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '#app/utils/db.server'
import { type Route } from './+types/post-videos.$videoId'

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

export async function loader({ params, request }: Route.LoaderArgs) {
	const video = await prisma.postVideo.findUnique({
		where: { id: params.videoId },
		select: { contentType: true, s3Key: true },
	})

	if (!video) {
		throw new Response('Not found', { status: 404 })
	}

	// Stream from S3 with Range support
	const range = request.headers.get('Range') ?? undefined
	const command = new GetObjectCommand({
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: video.s3Key,
		...(range ? { Range: range } : {}),
	})
	const s3Response = await s3.send(command)

	const body = s3Response.Body as unknown as ReadableStream | null
	if (!body) {
		throw new Response('Not found', { status: 404 })
	}

	const headers = new Headers()
	if (video.contentType) headers.set('Content-Type', video.contentType)
	if (s3Response.ETag) headers.set('ETag', s3Response.ETag)
	if (s3Response.ContentLength)
		headers.set('Content-Length', String(s3Response.ContentLength))
	if (s3Response.LastModified)
		headers.set('Last-Modified', new Date(s3Response.LastModified).toUTCString())
	headers.set('Cache-Control', 'public, max-age=31536000, immutable')
	headers.set('Accept-Ranges', 'bytes')
	headers.set('Content-Disposition', 'inline')

	if (range && s3Response.ContentRange) {
		headers.set('Content-Range', s3Response.ContentRange)
		return new Response(body as any, { status: 206, headers })
	}

	return new Response(body as any, { status: 200, headers })
}
