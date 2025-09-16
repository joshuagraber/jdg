import {
	useForm,
	getFormProps,
	getInputProps,
	getTextareaProps,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { fromZonedTime } from 'date-fns-tz'
import { useEffect, useRef, useState } from 'react'
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
import { compileMDX } from '#app/utils/mdx.server.ts'
import { makePostSlug } from '#app/utils/mdx.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/create'
import { PostImageManager } from './__image-manager'
import { PostSchemaCreate as PostSchema } from './__types'
import { useFileUploader } from './__useFileUploader'
import { PostVideoManager } from './__video-manager'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader() {
	const [images, videos] = await Promise.all([
		await prisma.postImage.findMany({
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

	invariantResponse(images, 'Error fetching images', { status: 404 })
	invariantResponse(videos, 'Error fetching videos', { status: 404 })

	return { images, videos }
}

export async function action({ request }: Route.ActionArgs) {
	const authorId = await requireUserId(request)
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

	const { title, content, description, publishAt, slug } = submission.value

	const publishAtWithTimezone = publishAt
		? fromZonedTime(publishAt, timeZone)
		: null

	try {
		const created = await prisma.post.create({
			data: {
				title,
				content,
				description,
				slug: makePostSlug(title, slug),
				publishAt: publishAtWithTimezone,
				authorId,
			},
		})

		// Warm compiled MDX & inline previews (non-blocking)
		void compileMDX(content, { title })

		return redirectWithToast('/admin/fragments', {
			title: 'Post created',
			description: `Post "${title}" created successfully.`,
		})
	} catch {
		return data(
			{ result: submission.reply({ formErrors: ['Failed to create post'] }) },
			{ status: 500 },
		)
	}
}

export default function NewPost() {
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isPending = navigation.state === 'submitting'
	const { images, videos } = useLoaderData<typeof loader>()

	const handleImageUpload = useFileUploader({
		path: '/admin/fragments/images/create',
	})

	const [form, fields] = useForm({
		id: 'new-post-form',
		constraint: getZodConstraint(PostSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: PostSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	const [content, setContent] = useState('')
	const contentRef = useRef<HTMLTextAreaElement>(null)

	// Sync MDEditor value with the hidden textarea
	useEffect(() => {
		if (contentRef.current) {
			contentRef.current.value = content
		}
	}, [content])

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto max-w-4xl space-y-8 p-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold">New Post</h1>
					<p className="text-muted-foreground">
						Create a new blog post or fragment
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
							htmlFor: fields.slug.id,
							children: 'Slug (optional - defaults to kebab-cased title)',
						}}
						inputProps={{
							...getInputProps(fields.slug, { type: 'text' }),
						}}
						errors={fields.slug.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.publishAt.id,
							children:
								'When should this post be published? (optional - defaults to now)',
						}}
						inputProps={{
							...getInputProps(fields.publishAt, { type: 'datetime-local' }),
						}}
						errors={fields.publishAt.errors}
					/>

					<div className="space-y-3">
						<label className="block text-sm font-medium">Content</label>
						<div className="rounded-lg border border-input bg-background shadow-sm">
							<MDXEditorComponent
								images={images.map((image) => getPostImageSource(image.id))}
								imageUploadHandler={handleImageUpload}
								markdown={content}
								onChange={setContent}
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

					<StatusButton
						type="submit"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						disabled={isPending}
						className="w-full"
					>
						Create Post
					</StatusButton>
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
