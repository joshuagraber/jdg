import sharp from 'sharp'

const MAX_POST_IMAGE_WIDTH = 1600
const POST_IMAGE_WEBP_QUALITY = 82
const WEBP_CONTENT_TYPE = 'image/webp'

function getWebpFileName(fileName: string) {
	const baseName = fileName.trim().replace(/\.[^/.]+$/, '') || 'image'
	return `${baseName}.webp`
}

export async function processPostImage(buffer: Buffer, fileName: string) {
	const { data, info } = await sharp(buffer)
		.rotate()
		.resize({
			width: MAX_POST_IMAGE_WIDTH,
			withoutEnlargement: true,
			fit: 'inside',
		})
		.webp({ quality: POST_IMAGE_WEBP_QUALITY })
		.toBuffer({ resolveWithObject: true })

	return {
		buffer: data,
		contentType: WEBP_CONTENT_TYPE,
		fileName: getWebpFileName(fileName),
		width: info.width,
		height: info.height,
	}
}

export async function getImageDimensions(
	buffer: Buffer,
): Promise<{ width?: number; height?: number }> {
	const meta = await sharp(buffer).metadata()
	return { width: meta.width, height: meta.height }
}
