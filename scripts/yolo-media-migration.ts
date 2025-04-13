import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { config } from 'dotenv'
import {prisma} from '#app/utils/db.server'


const s3 = new S3Client({
  region: process.env.AWS_REGION ?? '',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
})

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from project root
config({ path: path.resolve(__dirname, '../.env') })

// Verify environment variables are loaded
console.log('Environment check:', {
  region: process.env.AWS_REGION,
  bucketName: process.env.AWS_BUCKET_NAME,
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
})


async function yoloMigrate() {
  console.log('🚀 Starting YOLO migration...')
  
  // Images
  const images = await prisma.postImage.findMany({
    where: { 
      s3Key: null
    },
  })
  
  console.log(`Found ${images.length} images to migrate...`)
  
  for (const [index, image] of images.entries()) {
    const key = `images/migrated-${Date.now()}-${image.id}`
    if (!image.blob) continue;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: image.blob,
        ContentType: image.contentType,
      }))
      
      await prisma.postImage.update({
        where: { id: image.id },
        data: { 
          s3Key: key,
          blob: null,
        },
      })
      
      console.log(`✅ Migrated image ${index + 1}/${images.length}`)
    } catch (error) {
      console.error(`❌ Failed to migrate image ${image.id}:`, error)
    }
  }

  // Videos (same pattern as images)
  const videos = await prisma.postVideo.findMany({
    where: { 
      s3Key: null,
    },
  })
  
  console.log(`Found ${videos.length} videos to migrate...`)
  
  for (const [index, video] of videos.entries()) {
    const key = `videos/migrated-${Date.now()}-${video.id}`
    if (!video.blob) continue;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: video.blob,
        ContentType: video.contentType,
      }))
      
      await prisma.postVideo.update({
        where: { id: video.id },
        data: { 
          s3Key: key,
          blob: null,
        },
      })
      
      console.log(`✅ Migrated video ${index + 1}/${videos.length}`)
    } catch (error) {
      console.error(`❌ Failed to migrate video ${video.id}:`, error)
    }
  }

  console.log('🎉 YOLO Migration Complete!')
}

yoloMigrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
