import { Worker } from 'worker_threads'
import { prisma } from '#app/utils/db.server'
import { type Route } from './+types/post-videos.$videoId'


export async function loader({ params }: Route.LoaderArgs) {
  // Create a promise that will resolve with our video data
  const videoPromise = new Promise((resolve, reject) => {
    const worker = new Worker(
      `
      const { parentPort } = require('worker_threads');
      const { PrismaClient } = require('@prisma/client');

      async function getVideo() {
        const prisma = new PrismaClient();
        try {
          const video = await prisma.postVideo.findUnique({
            where: { id: "${params.videoId}" },
            select: { blob: true, contentType: true },
          });
          parentPort.postMessage(video);
        } catch (error) {
          parentPort.postMessage({ error: error.message });
        } finally {
          await prisma.$disconnect();
        }
      }

      getVideo();
      `,
      { eval: true }
    )

    worker.on('message', resolve)
    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })
  })

  const video = await videoPromise as any

  if (!video || video.error) {
    throw new Response('Not found', { status: 404 })
  }

  return new Response(video.blob, {
    headers: {
      'Content-Type': video.contentType,
      'Content-Length': Buffer.byteLength(video.blob).toString(),
      'Content-Disposition': 'inline',
    },
  })
}
