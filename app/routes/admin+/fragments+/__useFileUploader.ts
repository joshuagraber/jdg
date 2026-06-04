import { useFetcher } from 'react-router'

const DEFAULT_TIMEOUT = 1000 * 120 // 2-minute timeout by default

/**
 * This is useful for creating an image upload handler for the MDX editor. It's not actually the best way of doing things.
 */
export function useFileUploader({
	uploadTimeout = DEFAULT_TIMEOUT,
	path,
}: {
	uploadTimeout?: number
	path: string
}) {
	const imageFetcher = useFetcher<string>()

	return async (file: File) => {
		const formData = new FormData()
		formData.append('file', file)

		// Create a promise that resolves when the upload is complete
		const uploadPromise = new Promise<string>(async (resolve, reject) => {
			await imageFetcher.submit(formData, {
				method: 'POST',
				action: path,
				encType: 'multipart/form-data',
			})

			const interval = setInterval(() => {
				if (imageFetcher.data) {
					resolve(imageFetcher.data)
					clearInterval(interval)
				}
			}, 250)

			const timeout = setTimeout(() => {
				reject(new Error('Image upload timed out'))
				clearInterval(interval)
				clearTimeout(timeout)
			}, uploadTimeout)
		})

		try {
			const imageUrl = await uploadPromise
			return imageUrl
		} catch (error) {
			console.error('Image upload failed:', error)
			throw error
		}
	}
}
