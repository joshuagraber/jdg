import sharp from 'sharp'

export async function resizeImage(buffer: Buffer): Promise<Buffer> {
	return sharp(buffer)
		.resize({
			width: 1600,
			withoutEnlargement: true, // This prevents upscaling of smaller images
			fit: 'inside', // This maintains aspect ratio
		})
		.toBuffer()
}
