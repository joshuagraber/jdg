#!/usr/bin/env -S tsx
// Load local .env only during development so production
// environments (like Fly) don't require the dotenv package.
if (process.env.NODE_ENV !== 'production') {
	await import('dotenv/config')
}

import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import { prisma } from '../app/utils/db.server.ts'
import { processPostImage } from '../app/utils/image-processing.server.ts'
import { IMMUTABLE_CACHE_CONTROL } from '../app/utils/s3.server.ts'

const WEBP_CONTENT_TYPE = 'image/webp'

type Options = {
	deleteOriginals: boolean
	dryRun: boolean
	id?: string
	limit?: number
}

type NodeReadable = {
	on: (
		event: 'data' | 'end' | 'error',
		listener: (chunk?: Buffer | Uint8Array | string | Error) => void,
	) => void
}

function parseArgs(argv: Array<string>): Options {
	const options: Options = {
		deleteOriginals: false,
		dryRun: false,
	}

	for (const arg of argv) {
		if (arg === '--delete-originals') {
			options.deleteOriginals = true
			continue
		}
		if (arg === '--dry-run') {
			options.dryRun = true
			continue
		}
		if (arg.startsWith('--id=')) {
			const id = arg.slice('--id='.length).trim()
			if (!id) throw new Error('--id requires a value')
			options.id = id
			continue
		}
		if (arg.startsWith('--limit=')) {
			const limit = Number(arg.slice('--limit='.length))
			if (!Number.isInteger(limit) || limit < 1) {
				throw new Error('--limit must be a positive integer')
			}
			options.limit = limit
			continue
		}

		throw new Error(`Unknown option: ${arg}`)
	}

	return options
}

function requireEnv() {
	const required = [
		'AWS_REGION',
		'AWS_ACCESS_KEY_ID',
		'AWS_SECRET_ACCESS_KEY',
		'AWS_BUCKET_NAME',
		'DATABASE_URL',
	] as const

	const missing = required.filter((key) => !process.env[key])
	if (missing.length) {
		throw new Error(
			`Missing required env vars: ${missing.join(', ')}. Did you configure .env?`,
		)
	}
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
	if (!body) throw new Error('S3 object response did not include a body')

	if (body instanceof Uint8Array) return Buffer.from(body)

	if (
		typeof body === 'object' &&
		'transformToByteArray' in body &&
		typeof body.transformToByteArray === 'function'
	) {
		return Buffer.from(await body.transformToByteArray())
	}

	if (
		typeof body === 'object' &&
		'arrayBuffer' in body &&
		typeof body.arrayBuffer === 'function'
	) {
		return Buffer.from(await body.arrayBuffer())
	}

	if (
		typeof body === 'object' &&
		'on' in body &&
		typeof body.on === 'function'
	) {
		return new Promise<Buffer>((resolve, reject) => {
			const stream = body as NodeReadable
			const chunks: Array<Buffer> = []
			stream.on('data', (chunk) => {
				if (chunk instanceof Error || chunk === undefined) return
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
			})
			stream.on('end', () => resolve(Buffer.concat(chunks)))
			stream.on('error', reject)
		})
	}

	throw new Error('Unsupported S3 body type')
}

function toWebpKey(s3Key: string) {
	const withoutExtension = s3Key.replace(/\.[^/.]+$/, '')
	return `${withoutExtension || s3Key}.webp`
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	requireEnv()

	const s3 = new S3Client({
		region: process.env.AWS_REGION,
		credentials: {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
		},
	})

	const images = await prisma.postImage.findMany({
		where: {
			...(options.id ? { id: options.id } : {}),
			NOT: { contentType: WEBP_CONTENT_TYPE },
		},
		select: {
			id: true,
			s3Key: true,
			contentType: true,
		},
		take: options.limit,
		orderBy: { createdAt: 'asc' },
	})

	const mode = options.dryRun ? 'dry run' : 'write'
	console.log(`Found ${images.length} post images to migrate (${mode})`)

	let converted = 0
	let failed = 0
	let skipped = 0

	for (const image of images) {
		const nextKey = toWebpKey(image.s3Key)

		if (image.s3Key === nextKey) {
			console.warn(`Skipping ${image.id}: s3Key already ends with .webp`)
			skipped += 1
			continue
		}

		try {
			console.log(`${image.id}: ${image.s3Key} -> ${nextKey}`)

			if (options.dryRun) {
				converted += 1
				continue
			}

			const response = await s3.send(
				new GetObjectCommand({
					Bucket: process.env.AWS_BUCKET_NAME,
					Key: image.s3Key,
				}),
			)
			const originalBuffer = await bodyToBuffer(response.Body)
			const processed = await processPostImage(originalBuffer, nextKey)

			await s3.send(
				new PutObjectCommand({
					Bucket: process.env.AWS_BUCKET_NAME,
					Key: nextKey,
					Body: processed.buffer,
					ContentType: processed.contentType,
					CacheControl: IMMUTABLE_CACHE_CONTROL,
				}),
			)

			await prisma.postImage.update({
				where: { id: image.id },
				data: {
					contentType: processed.contentType,
					s3Key: nextKey,
					width: processed.width ?? null,
					height: processed.height ?? null,
				},
			})

			if (options.deleteOriginals) {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: process.env.AWS_BUCKET_NAME,
						Key: image.s3Key,
					}),
				)
			}

			converted += 1
		} catch (error) {
			failed += 1
			console.error(`Failed ${image.id}`, error)
		}
	}

	console.log(
		`Done. Converted: ${converted}. Skipped: ${skipped}. Failed: ${failed}.`,
	)
	await prisma.$disconnect()
}

main().catch(async (error) => {
	console.error(error)
	await prisma.$disconnect()
	process.exit(1)
})
