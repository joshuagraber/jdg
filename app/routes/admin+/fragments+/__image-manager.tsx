import { type PostImage } from '@prisma/client'
import React, { useState } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'
import { Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { type action as imageCreateAction } from '#app/routes/admin+/fragments+/images.create.tsx'
import { getPostImageSource } from '#app/utils/misc.tsx'
import { DeleteImage } from './__deleters'

type Image = Pick<PostImage, 'id' | 'altText' | 'title' | 's3Key'>

interface PostImageManagerProps {
	images: Image[]
}

export function PostImageManager({ images }: PostImageManagerProps) {
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const imageCreateFetcher = useFetcher<typeof imageCreateAction>()

	const handleCopyMarkdown = async (image: Image) => {
		const path =
			getPostImageSource(image.id, { s3Key: image.s3Key }) ??
			getPostImageSource(image.id, { relative: true }) ??
			`/resources/post-images/${image.id}`
		const markdown = `![${image.altText}](${path}${image.title ? ` "${image.title}"` : ''})`
		// Safari mobile fallback using execCommand
		if (navigator.clipboard === undefined) {
			const textArea = document.createElement('textarea')
			textArea.value = markdown
			document.body.appendChild(textArea)
			textArea.select()
			try {
				document.execCommand('copy')
				setCopiedId(image.id)
				setTimeout(() => setCopiedId(null), 2500)
			} catch (err) {
				console.error('Failed to copy text: ', err)
			}
			document.body.removeChild(textArea)
			return
		}
		// Modern browsers
		await navigator.clipboard.writeText(markdown)
		setCopiedId(image.id)
		setTimeout(() => setCopiedId(null), 2500)
	}

	React.useEffect(() => {
		if (imageCreateFetcher.data) {
			if (
				typeof imageCreateFetcher.data === 'object' &&
				'error' in imageCreateFetcher.data
			) {
				toast.error(imageCreateFetcher.data.error)
			}

			if (typeof imageCreateFetcher.data === 'string') {
				toast.success('Image uploaded successfully!')
			}
		}
	}, [imageCreateFetcher.data])

	return (
		<div>
			<h4>Upload new image</h4>
			<imageCreateFetcher.Form
				method="POST"
				action="/admin/fragments/images/create"
				encType="multipart/form-data"
				className="mb-12 space-y-6"
			>
				<div className="flex flex-col gap-4">
					<Field
						labelProps={{
							children: 'Image',
						}}
						inputProps={{
							type: 'file',
							name: 'file',
							accept: 'image/*',
							className:
								'flex w-full h-auto rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-500 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary-foreground file:bg-primary hover:file:cursor-pointer',
						}}
					/>

					<Field
						labelProps={{ children: 'Alt Text' }}
						inputProps={{
							type: 'text',
							name: 'altText',
							placeholder: 'Descriptive alt text for the image',
						}}
					/>

					<Field
						labelProps={{ children: 'Title' }}
						inputProps={{
							type: 'text',
							name: 'title',
							placeholder: 'Image title',
						}}
					/>
				</div>

				<Button type="submit">
					{imageCreateFetcher.state === 'submitting'
						? 'Uploading...'
						: 'Upload Image'}
				</Button>
			</imageCreateFetcher.Form>

			<div className="grid max-h-[700px] gap-6 overflow-y-scroll sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
				<h4 className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4">
					Update current images
				</h4>
				{images.map((image) => (
					<div key={image.id} className="space-y-4 rounded-lg border p-4">
						<div className="relative aspect-video">
							<img
								src={
									getPostImageSource(image.id, { s3Key: image.s3Key }) ??
									getPostImageSource(image.id, { relative: true }) ??
									`/resources/post-images/${image.id}`
								}
								alt={image.altText ?? ''}
								className="h-full w-full rounded-md object-cover"
							/>
						</div>

						<p
							className="font-mono text-xs text-muted-foreground"
							aria-label={`Resource ID ${image.id}`}
						>
							Resource ID: {image.id}
						</p>

						<ImageMetadataForm image={image} />

						<DeleteImage imageId={image.id} />

						<Button
							onClick={() => handleCopyMarkdown(image)}
							variant="outline"
							className="w-full"
						>
							{copiedId === image.id ? (
								<>
									<Icon name="check" /> Copied!
								</>
							) : (
								<>
									<Icon name="copy" />
									Copy markdown
								</>
							)}
						</Button>
					</div>
				))}
			</div>
		</div>
	)
}

function ImageMetadataForm({ image }: { image: Image }) {
	const fetcher = useFetcher()

	return (
		<fetcher.Form method="POST" action="/admin/fragments/images/edit">
			<Field
				labelProps={{ children: 'Alt text' }}
				inputProps={{
					name: 'altText',
					defaultValue: image.altText ?? '',
					type: 'text',
				}}
			/>
			<Field
				labelProps={{ children: 'Title' }}
				inputProps={{
					name: 'title',
					defaultValue: image.title ?? '',
					type: 'text',
				}}
			/>
			<Field
				className="hidden"
				labelProps={{ children: 'Image ID' }}
				inputProps={{
					name: 'imageId',
					defaultValue: image.id,
					type: 'text',
				}}
			/>

			<StatusButton
				type="submit"
				className="w-full"
				status={
					fetcher.state !== 'idle'
						? 'pending'
						: fetcher.data && fetcher.state === 'idle'
							? 'success'
							: 'idle'
				}
			>
				Update metadata
			</StatusButton>
		</fetcher.Form>
	)
}
