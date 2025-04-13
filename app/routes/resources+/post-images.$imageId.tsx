import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { invariantResponse } from '@epic-web/invariant'
import { type LoaderFunctionArgs } from 'react-router';
import { prisma } from '#app/utils/db.server'

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

export async function loader({ params }: LoaderFunctionArgs) {
	const image = await prisma.postImage.findUnique({
		where: { id: params.imageId },
		select: { blob: true, contentType: true, s3Key: true },
	})

	invariantResponse(image, 'Not found', { status: 404 })

	if (image.blob) {
		console.debug('returning image from db')

		return new Response(image.blob, {
			headers: {
				'Content-Type': image.contentType,
				'Content-Length': Buffer.from(image.blob).length.toString(),
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		})
	}

	if (image.s3Key) {
		const command = new GetObjectCommand({
			Bucket: process.env.AWS_BUCKET_NAME,
			Key: image.s3Key,
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
}
