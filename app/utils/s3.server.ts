// app/utils/s3.server.ts
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

export const s3 = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
})

export async function getSignedUploadUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
    })
    return getSignedUrl(s3, command, { expiresIn: 3600 })
}

export async function getSignedGetUrl(key: string) {
	const command = new GetObjectCommand({
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: key,
	})
	return getSignedUrl(s3, command, { expiresIn: 3600 })
}
