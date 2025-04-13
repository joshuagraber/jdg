import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '#app/utils/db.server'
import { type Route } from './+types/post-videos.$videoId'

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

export async function loader({ params }: Route.LoaderArgs) {
	const video = await prisma.postVideo.findUnique({
		where: { id: params.videoId },
		select: { contentType: true, s3Key: true },
	})

	if (!video) {
		throw new Response('Not found', { status: 404 })
	}

		console.debug('returning video from S3 bucket')
		const command = new GetObjectCommand({
			Bucket: process.env.AWS_BUCKET_NAME,
			Key: video.s3Key,
  	})

		const signedUrl = await getSignedUrl(s3, command, { 
			expiresIn: 3600 
		})

		return new Response(null, {
			status: 303,
			headers: {
				Location: signedUrl,
				'Cache-Control': 'public, max-age=3000',
			},
		})
}