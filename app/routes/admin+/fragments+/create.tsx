import {
	useForm,
	getFormProps,
	getInputProps,
	getTextareaProps,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { DateTime } from 'luxon'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
	data,
	type ActionFunctionArgs,
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from 'react-router'
import { type z } from 'zod'
import { Field, ErrorList } from '#app/components/forms'
import { MDXEditorComponent } from '#app/components/mdx/editor.tsx'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { formatContentForEditor, makePostSlug } from '#app/utils/mdx.ts'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
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

export async function action({ request }: ActionFunctionArgs) {
	const authorId = await requireUserId(request)
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

	const { title, content, description, publishAt, slug, timezone } =
		submission.value

	const publishAtWithTimezone = publishAt
		? DateTime.fromISO(publishAt.toISOString(), { zone: timezone }).toISO()
		: null

	console.debug({ publishAt, publishAtWithTimezone })

	try {
		const post = await prisma.post.create({
			data: {
				title,
				content,
				description,
				slug: makePostSlug(title, slug),
				publishAt: publishAtWithTimezone,
				authorId,
			},
		})

		console.debug({ stored: post.publishAt })

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
	const [key, setKey] = useState('begin')
	const contentRef = useRef<HTMLTextAreaElement>(null)

	// Sync MDEditor value with the hidden textarea
	useEffect(() => {
		if (contentRef.current) {
			contentRef.current.value = content
			contentRef.current.dispatchEvent(new Event('change'))
		}
	}, [content])

	useEffect(() => {
		const timezoneField = document.getElementById(
			'timezone',
		) as HTMLInputElement
		if (timezoneField) {
			console.log('timezone field being set', {
				intl: Intl.DateTimeFormat().resolvedOptions().timeZone,
			})
			timezoneField.value =
				Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
		}
	}, [])

	return (
		<div className="p-8">
			<h1 className="mb-6 text-2xl font-bold">New Post</h1>

			<Form
				method="post"
				{...getFormProps(form)}
				className="mb-12 space-y-6"
				onChange={(event: FormEvent) => {
					if (
						['description', 'title', 'publishAt', 'slug'].includes(
							// @ts-expect-error
							event.target.name,
						)
					) {
						const data = new FormData((event.target as HTMLFormElement).form)
						setContent(
							formatContentForEditor(
								Object.fromEntries(data.entries()) as unknown as z.infer<
									typeof PostSchema
								>,
							),
						)
						setKey(Math.random().toString())
					}
				}}
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
				<Field
					labelProps={{
						htmlFor: 'timezone',
						children: 'Timezone',
					}}
					inputProps={{
						id: 'timezone',
						name: 'timezone',
						type: 'text',
						defaultValue: 'America/New_York',
					}}
					errors={fields.timezone.errors}
				/>

				<div>
					<label className="mb-1 block text-sm font-medium">Content</label>
					<div className="rounded-md border">
						<MDXEditorComponent
							key={key}
							images={images.map((image) => getPostImageSource(image.id))}
							imageUploadHandler={handleImageUpload}
							markdown={content}
							onChange={setContent}
							className="min-h-[400px]"
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

			<h2>Manage post images</h2>
			<PostImageManager images={images} />

			<h2>Manage post videos</h2>
			<PostVideoManager videos={videos} />
		</div>
	)
}
