import { type PostVideo } from '@prisma/client'
import React, { useState } from 'react'
import { useFetcher } from 'react-router'
import { Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { getPostVideoSource } from '#app/utils/misc.tsx'
import { DeleteVideo } from './__deleters'

type Video = Pick<PostVideo, 'id' | 'altText' | 'title'>

interface PostVideoManagerProps {
	videos: Video[]
}

export function PostVideoManager({ videos }: PostVideoManagerProps) {
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const videoCreateFetcher = useFetcher()

	const handleCopyMarkdown = async (video: Video) => {
		const path = getPostVideoSource(video.id, { relative: true })
		const markdown = `<video controls src="${path}" title="${video.title ?? ''}" width="100%" height="auto">${
			video.altText ?? ''
		}</video>`
		await navigator.clipboard.writeText(markdown)
		setCopiedId(video.id)
		setTimeout(() => setCopiedId(null), 2000)
	}

	return (
		<div className="space-y-8">
			<videoCreateFetcher.Form
				method="POST"
				action="/admin/fragments/videos/create"
				encType="multipart/form-data"
				className="mb-12 space-y-6"
			>
				<div className="flex flex-col gap-4">
					<h4>Upload new video</h4>

					<Field
						labelProps={{
							children: 'Video',
						}}
						inputProps={{
							type: 'file',
							name: 'file',
							accept: 'video/*',
							className:
								'flex w-full h-auto rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-500 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary-foreground file:bg-primary hover:file:cursor-pointer',
						}}
					/>
					<Field
						labelProps={{ children: 'Alt Text' }}
						inputProps={{
							type: 'text',
							name: 'altText',
							placeholder: 'Descriptive alt text for the video',
						}}
					/>
					<Field
						labelProps={{ children: 'Title' }}
						inputProps={{
							type: 'text',
							name: 'title',
							placeholder: 'Title for the video',
						}}
					/>
				</div>
				<StatusButton
					type="submit"
					status={
						videoCreateFetcher.state === 'submitting' ? 'pending' : 'idle'
					}
				>
					Upload Video
				</StatusButton>
			</videoCreateFetcher.Form>

			<div className="grid max-h-[700px] gap-6 overflow-y-scroll sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
				<h4 className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4">
					Update current videos
				</h4>

				{videos.map((video) => (
					<div key={video.id} className="space-y-4 rounded-lg border p-4">
						<div>
							<video
								src={getPostVideoSource(video.id, { relative: true })}
								controls
								className="h-auto w-full rounded-lg object-cover"
							/>
						</div>

						<VideoMetadataForm video={video} />

						<DeleteVideo id={video.id} />
						<div>
							<Button
								onClick={() => handleCopyMarkdown(video)}
								variant="outline"
								className="w-full"
							>
								<Icon
									name={copiedId === video.id ? 'check' : 'copy'}
									className="mr-2 h-4 w-4"
								/>
								{copiedId === video.id ? 'Copied!' : 'Copy Markdown'}
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function VideoMetadataForm({ video }: { video: Video }) {
	const fetcher = useFetcher()
	return (
		<fetcher.Form method="POST" action="/admin/fragments/videos/edit">
			<Field
				labelProps={{ children: 'Alt text' }}
				inputProps={{
					name: 'altText',
					defaultValue: video.altText ?? '',
					type: 'text',
				}}
			/>
			<Field
				labelProps={{ children: 'Title' }}
				inputProps={{
					name: 'title',
					defaultValue: video.title ?? '',
					type: 'text',
				}}
			/>
			<Field
				className="hidden"
				labelProps={{ children: 'Image ID' }}
				inputProps={{
					name: 'id',
					defaultValue: video.id,
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
