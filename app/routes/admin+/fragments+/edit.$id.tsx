import {
	useForm,
	getFormProps,
	getInputProps,
	getTextareaProps,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { fromZonedTime } from 'date-fns-tz'
import { useEffect, useRef, useState } from 'react'
import {
	data,
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from 'react-router'
import { Field, ErrorList, TextareaField } from '#app/components/forms'
import { MDXEditorComponent } from '#app/components/mdx/editor.tsx'
import { Button } from '#app/components/ui/button'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId } from '#app/utils/auth.server'
import { getHints, useHints } from '#app/utils/client-hints.tsx'
import { prisma } from '#app/utils/db.server'
import { FRAGMENTS_POSTS_PER_PAGE } from '#app/utils/fragments.ts'
import {
	warmFragmentsIndexPages,
	warmPublishedFragment,
} from '#app/utils/fragments.server.ts'
import { formatDateStringForPostDefault } from '#app/utils/mdx.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { invalidatePostCaches } from '#app/utils/preview-utils.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/edit.$id'
import { PostImageManager } from './__image-manager'
import { PostSchemaUpdate as PostSchema } from './__types'
import { useFileUploader } from './__useFileUploader'
import { PostVideoManager } from './__video-manager'
import mdxEditorStyleUrl from '@mdxeditor/editor/style.css?url'

type PostPreviewFields = {
	previewTitle: string | null
	previewDescription: string | null
	previewImageId: string | null
}

export const links = () => [{ rel: 'stylesheet', href: mdxEditorStyleUrl }]

export async function loader({ params, request }: Route.LoaderArgs) {
	await requireUserId(request)

	const [post, images, videos] = await Promise.all([
		prisma.post.findUnique({
			where: { id: params.id },
		}),
		prisma.postImage.findMany({
			select: {
				id: true,
				altText: true,
				title: true,
				s3Key: true,
			},
			orderBy: { createdAt: 'desc' },
		}),
		await prisma.postVideo.findMany({
			select: {
				id: true,
				altText: true,
				title: true,
			},
			orderBy: { createdAt: 'desc' },
		}),
	])

	invariantResponse(post, 'Not found', { status: 404 })
	invariantResponse(images, 'Error fetching images', { status: 404 })
	invariantResponse(videos, 'Error fetching videos', { status: 404 })

	const postWithPreview = post as PostPreviewFields & {
		id: string
		title: string
		content: string
		description: string | null
		slug: string
		publishAt: Date | null
	}

	return { post: postWithPreview, images, videos }
}

export async function action({ request, params }: Route.ActionArgs) {
	await requireUserId(request)
	const formData = await request.formData()
	const { timeZone } = getHints(request)

	const submission = await parseWithZod(formData, {
		schema: PostSchema,
		async: true,
	})

	if (submission.status !== 'success') {
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const postId = request.url.split('edit/')[1]
	const existingPost = postId
		? await prisma.post.findFirst({
				where: { id: postId },
			})
		: undefined

	const {
		title,
		content,
		description,
		publishAt,
		slug,
		previewTitle,
		previewDescription,
		previewImageId,
	} = submission.value
	const publishAtWithTimezone = publishAt
		? fromZonedTime(publishAt, timeZone)
		: null

	const published = publishAtWithTimezone ?? existingPost?.publishAt ?? null
	const normalizedPreviewTitle = previewTitle?.trim() ?? null
	const normalizedPreviewDescription = previewDescription?.trim() ?? null
	const normalizedPreviewImageId = previewImageId?.trim() ?? null

	try {
		await prisma.post.update({
			where: { id: params.id },
			data: {
				title,
				content,
				description,
				slug,
				publishAt: published,
				previewTitle: normalizedPreviewTitle,
				previewDescription: normalizedPreviewDescription,
				previewImageId: normalizedPreviewImageId,
			},
		} as any)

		// Invalidate caches related to this post (old content and new content URLs)
		await invalidatePostCaches(
			existingPost?.content ?? undefined,
			content,
			existingPost?.title ?? undefined,
			title,
			existingPost?.slug ?? undefined,
			slug,
		)
		// Warm the exact public fragment payload cache when the post is publishable.
		void warmPublishedFragment(slug)
		void warmFragmentsIndexPages({ top: FRAGMENTS_POSTS_PER_PAGE })

		return redirectWithToast('/admin/fragments', {
			title: 'Post updated',
			description: `Post "${title}" updated successfully.`,
		})
	} catch {
		return data(
			{ result: submission.reply({ formErrors: ['Failed to update post'] }) },
			{ status: 500 },
		)
	}
}
export default function EditPost() {
	const { post, images, videos } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isPending = navigation.state === 'submitting'
	const { timeZone } = useHints()

	const handleImageUpload = useFileUploader({
		path: '/admin/fragments/images/create',
	})

	const [form, fields] = useForm({
		id: 'edit-post-form',
		constraint: getZodConstraint(PostSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: PostSchema })
		},
		shouldRevalidate: 'onBlur',
		defaultValue: {
			title: post.title,
			content: post.content,
			description: post.description,
			slug: post.slug,
			previewTitle: post.previewTitle ?? '',
			previewDescription: post.previewDescription ?? '',
			previewImageId: post.previewImageId ?? '',
			publishAt: post.publishAt
				? formatDateStringForPostDefault(
						// ensure if rendered on server that the date is in client TZ
						new Date(post.publishAt.toLocaleString('en', { timeZone })),
					)
				: null,
		},
	})

	const [content, setContent] = useState(post.content)
	const [showDateField, setShowDateField] = useState(false)
	const contentRef = useRef<HTMLTextAreaElement>(null)

	// Sync editor value with the hidden textarea
	useEffect(() => {
		if (contentRef.current) {
			contentRef.current.value = content
			contentRef.current.dispatchEvent(new Event('change'))
		}
	}, [content])

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto max-w-4xl space-y-8 p-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold">Edit Post</h1>
					<p className="text-muted-foreground">
						Update your blog post or fragment
					</p>
				</div>

				<Form method="post" {...getFormProps(form)} className="space-y-8">
					<Field
						labelProps={{
							htmlFor: fields.title.id,
							children: 'Title',
						}}
						inputProps={{
							...getInputProps(fields.title, { type: 'text' }),
						}}
						errors={fields.title.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.description.id,
							children: 'Description',
						}}
						inputProps={{
							...getInputProps(fields.description, { type: 'text' }),
						}}
						errors={fields.description.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.previewTitle.id,
							children: 'Link preview title (optional)',
						}}
						inputProps={{
							...getInputProps(fields.previewTitle, { type: 'text' }),
						}}
						errors={fields.previewTitle.errors}
					/>
					<TextareaField
						labelProps={{
							htmlFor: fields.previewDescription.id,
							children: 'Link preview description (optional)',
						}}
						textareaProps={getTextareaProps(fields.previewDescription)}
						errors={fields.previewDescription.errors}
					/>
					<div>
						<Field
							labelProps={{
								htmlFor: fields.previewImageId.id,
								children: 'Link preview image ID (optional)',
							}}
							inputProps={{
								...getInputProps(fields.previewImageId, { type: 'text' }),
								list: 'preview-image-options-edit',
							}}
							errors={fields.previewImageId.errors}
						/>
						<datalist id="preview-image-options-edit">
							{images.map((image) => (
								<option key={image.id} value={image.id}>
									{image.title ?? image.id}
								</option>
							))}
						</datalist>
					</div>
					<Field
						labelProps={{
							htmlFor: fields.slug.id,
							children: 'Slug',
						}}
						inputProps={{
							...getInputProps(fields.slug, { type: 'text' }),
						}}
						errors={fields.slug.errors}
					/>
					{post.publishAt && !showDateField && (
						<Button
							variant="outline"
							type="button"
							onClick={() => setShowDateField(true)}
						>
							Post is published. Edit the publish date?
						</Button>
					)}
					{(showDateField || !post.publishAt) && (
						<Field
							labelProps={{
								htmlFor: fields.publishAt.id,
								children: 'Update publish date',
							}}
							inputProps={{
								...getInputProps(fields.publishAt, { type: 'datetime-local' }),
							}}
							errors={fields.publishAt.errors}
						/>
					)}

					<div className="space-y-3">
						<label className="block text-sm font-medium">Content</label>
						<div className="rounded-lg border border-input bg-background shadow-sm">
							<MDXEditorComponent
								imageUploadHandler={handleImageUpload}
								images={images.map(
									(image) =>
										getPostImageSource(image.id, { s3Key: image.s3Key }) ??
										getPostImageSource(image.id, { relative: true }) ??
										`/resources/post-images/${image.id}`,
								)}
								markdown={content}
								onChange={setContent}
								diffSource={post.content}
								className="min-h-[500px]"
							/>
						</div>
						<textarea
							ref={contentRef}
							{...getTextareaProps(fields.content)}
							className="hidden"
						/>
						{fields.content.errors ? (
							<div className="text-sm text-destructive">
								{fields.content.errors}
							</div>
						) : null}
					</div>

					<ErrorList errors={form.errors} id={form.errorId} />

					<div className="flex gap-4">
						<StatusButton
							type="submit"
							status={isPending ? 'pending' : (form.status ?? 'idle')}
							disabled={isPending}
							className="w-full"
						>
							Save Changes
						</StatusButton>
					</div>
				</Form>

				<div className="space-y-6">
					<div className="space-y-4">
						<h2 className="text-xl font-semibold">Manage Images</h2>
						<PostImageManager images={images} />
					</div>

					<div className="space-y-4">
						<h2 className="text-xl font-semibold">Manage Videos</h2>
						<PostVideoManager videos={videos} />
					</div>
				</div>
			</div>
		</div>
	)
}
