#!/usr/bin/env -S tsx
// Load local .env only during development so production
// environments (like Fly) don't require the dotenv package.
if (process.env.NODE_ENV !== 'production') {
  await import('dotenv/config')
}
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { prisma } from '../app/utils/db.server.ts'

async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

async function main() {
  const required = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_BUCKET_NAME',
    // Database URL is required by Prisma under the hood
    'DATABASE_URL',
  ] as const

  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(
      `Missing required env vars: ${missing.join(', ')}. Did you configure .env?`,
    )
    process.exit(1)
  }

  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  const images = await prisma.postImage.findMany({
    where: { OR: [{ width: null }, { height: null }] },
    select: { id: true, s3Key: true },
  })
  console.log(`Found ${images.length} images missing dimensions`)

  for (const img of images) {
    try {
      const res = await s3.send(new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: img.s3Key,
      }))
      const body = res.Body as any
      if (!body) {
        console.warn(`No body for ${img.id}`)
        continue
      }
      const buf = await streamToBuffer(body)
      const meta = await sharp(buf).metadata()
      await prisma.postImage.update({
        where: { id: img.id },
        data: { width: meta.width ?? null, height: meta.height ?? null },
      })
      console.log(`Updated ${img.id} -> ${meta.width}x${meta.height}`)
    } catch (e) {
      console.error(`Failed ${img.id}`, e)
    }
  }

  console.log('Done')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
