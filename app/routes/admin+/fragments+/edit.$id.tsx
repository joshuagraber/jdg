import {
	useForm,
	getFormProps,
	getInputProps,
	getTextareaProps,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { DateTime } from 'luxon'
import  { useEffect, useRef, useState } from 'react'
import {
	data,
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from 'react-router'
import { Field, ErrorList } from '#app/components/forms'
import { MDXEditorComponent } from '#app/components/mdx/editor.tsx'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId } from '#app/utils/auth.server'
import { getHints } from '#app/utils/client-hints.tsx'
import { prisma } from '#app/utils/db.server'
import {
	formatDateStringForPostDefault,
} from '#app/utils/mdx.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/edit.$id'
import { PostImageManager } from './__image-manager'
import { PostSchemaUpdate as PostSchema } from './__types'
import { useFileUploader } from './__useFileUploader'
import { PostVideoManager } from './__video-manager'

export async function loader({ params, request }: Route.LoaderArgs) {
	await requireUserId(request)

	const [post, images, videos] = await Promise.all([
		prisma.post.findUnique({
			where: { id: params.id },
			select: {
				id: true,
				title: true,
				content: true,
				description: true,
				slug: true,
				publishAt: true,
			},
		}),
		prisma.postImage.findMany({
			select: {
				id: true,
				altText: true,
				title: true,
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

	return { post, images, videos }
}

export async function action({ request, params }: Route.ActionArgs) {
	await requireUserId(request)
	const { timeZone } = getHints(request);
	const formData = await request.formData()

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

	const { title, content, description, publishAt, slug } =
		submission.value
	const published = publishAt ?? existingPost?.publishAt ?? null
	const publishAtWithTimeZone = published
		? DateTime.fromISO(published.toISOString(), { zone: timeZone }).toISO()
		: null

		try {
		await prisma.post.update({
			where: { id: params.id },
			data: {
				title,
				content,
				description,
				slug,
				publishAt: publishAtWithTimeZone,
			},
		})

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
			publishAt: post.publishAt ? formatDateStringForPostDefault(new Date(post.publishAt)) : undefined,
		},
	})


	const [content, setContent] = useState(post.content)
	const contentRef = useRef<HTMLTextAreaElement>(null)

	// Sync editor value with the hidden textarea
	useEffect(() => {
		if (contentRef.current) {
			contentRef.current.value = content
			contentRef.current.dispatchEvent(new Event('change'))
		}
	}, [content])

	return (
		<div className="p-8">
			<h1 className="mb-6 text-2xl font-bold">Edit Post</h1>

			<Form
				method="post"
				{...getFormProps(form)}
				className="space-y-6"
			>
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
						htmlFor: fields.slug.id,
						children: 'Slug',
					}}
					inputProps={{
						...getInputProps(fields.slug, { type: 'text' }),
					}}
					errors={fields.slug.errors}
				/>
				<Field
					labelProps={{
						htmlFor: fields.publishAt.id,
						children: post.publishAt
							? 'This post is published. Would you like to update the publish date?'
							: 'This post is not yet published. When would you like to publish it?',
					}}
					inputProps={{
						...getInputProps(fields.publishAt, { type: 'datetime-local' }),
					}}
					errors={fields.publishAt.errors}
				/>

				<div>
					<label className="mb-1 block text-sm font-medium">Content</label>
					<div className="border">
						<MDXEditorComponent
							imageUploadHandler={handleImageUpload}
							images={images.map((image) => getPostImageSource(image.id))}
							markdown={content}
							onChange={setContent}
							diffSource={post.content}
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

			<h2>Manage post images</h2>
			<PostImageManager images={images} />

			<h2>Manage post videos</h2>
			<PostVideoManager videos={videos} />
		</div>
	)
}
