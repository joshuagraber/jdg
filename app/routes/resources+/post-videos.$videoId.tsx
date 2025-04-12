import { prisma } from '#app/utils/db.server'
import { type Route } from './+types/post-videos.$videoId'

export async function loader({ request, params }: Route.LoaderArgs) {
	const video = await prisma.postVideo.findUnique({
		where: { id: params.videoId },
		select: { blob: true, contentType: true },
	})

	if (!video) {
		throw new Response('Not found', { status: 404 })
	}

	const range = request.headers.get('range')
	const videoSize = Buffer.byteLength(video.blob)

	if (!range) {
		// No range requested, return full video with streaming headers
		return new Response(video.blob, {
			headers: {
				'Content-Type': video.contentType,
				'Content-Length': videoSize.toString(),
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'public, max-age=31536000',
			},
		})
	}

	// Handle range request
	const parts = range.replace(/bytes=/, '').split('-')
	const start = parseInt(parts?.[0] ?? '', 10)
	const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1
	const chunkSize = end - start + 1

	const videoBuffer = Buffer.from(video.blob)
	const chunk = videoBuffer.slice(start, end + 1)

	return new Response(chunk, {
		status: 206,
		headers: {
			'Content-Type': video.contentType,
			'Content-Length': chunkSize.toString(),
			'Accept-Ranges': 'bytes',
			'Content-Range': `bytes ${start}-${end}/${videoSize}`,
			'Cache-Control': 'public, max-age=31536000',
		},
	})
}
