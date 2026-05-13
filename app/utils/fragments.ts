import { type InternalLinkPreviewData } from '#app/utils/link-preview.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'

export const FRAGMENTS_POSTS_PER_PAGE = 5

type FragmentPreviewPost = {
	slug: string
	title: string
	description: string | null
	previewTitle: string | null
	previewDescription: string | null
	previewImageId: string | null
	previewImage: {
		s3Key: string | null
	} | null
}

export function getFragmentPreviewData(
	post: FragmentPreviewPost,
): InternalLinkPreviewData {
	const image = post.previewImageId
		? getPostImageSource(post.previewImageId, {
				s3Key: post.previewImage?.s3Key ?? null,
			})
		: null

	return {
		url: `/fragments/${post.slug}`,
		title: post.previewTitle ?? post.title,
		description: post.previewDescription ?? post.description,
		image,
		domain: null,
	}
}
