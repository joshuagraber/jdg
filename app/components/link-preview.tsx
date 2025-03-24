import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import {
	getCachedPreview,
	setCachedPreview,
} from '#app/utils/link-preview-cache.ts'
import { cn } from '#app/utils/misc.tsx'
import { Icon } from './ui/icon'

export interface LinkPreviewData {
	title?: string
	description?: string
	image?: string
	domain?: string
	url: string
}

interface LinkPreviewProps {
	url: string
	className?: string
}

export function LinkPreview({ url, className }: LinkPreviewProps) {
	const previewFetcher = useFetcher<LinkPreviewData>()
	// Track separate state to prevent image flicker
	const [isImageLoaded, setIsImageLoaded] = useState(false)
	const [cached, setCached] = useState<LinkPreviewData | null>(null)

	useEffect(() => {
		if (previewFetcher.state === 'idle' && !previewFetcher.data) {
			// Check cache first
			const cached = getCachedPreview(url)
			if (cached) {
				setCached(cached)
				return
			} else {
				// Fetch if not cached
				void (async () => {
					await previewFetcher.load(
						`/resources/link-preview?url=${encodeURIComponent(url)}`,
					)
				})()
			}
		}
	}, [url, previewFetcher])

	// Cache the response when we get it
	useEffect(() => {
		if (previewFetcher.data) {
			setCachedPreview(url, previewFetcher.data)
		}
	}, [previewFetcher.data, url])

	const isLoading =
		previewFetcher.state === 'loading' ||
		previewFetcher.state === 'submitting' ||
		!isImageLoaded
	const previewData = previewFetcher.data ?? cached

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				'jdg-link-preview',
				'group block cursor-pointer overflow-hidden rounded-md border border-primary no-underline transition-shadow focus:border-secondary-foreground',
				className,
				isLoading && 'h-80 sm:h-44',
			)}
		>
			{isLoading && (
				<div className="flex h-full w-full animate-pulse items-center justify-center bg-secondary p-4 dark:bg-secondary/30">
					{' '}
					<Icon
						className="h-16 w-16 text-secondary-foreground dark:text-primary"
						name="dots-horizontal"
					/>
				</div>
			)}
			{previewData && (
				<div className="flex flex-col sm:flex-row">
					{previewData.image && (
						<div className="h-44 flex-shrink-0 sm:h-44 sm:w-44">
							<img
								src={previewData.image}
								alt={previewData.title || ''}
								className="h-full w-full object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100"
								onLoad={() => setIsImageLoaded(true)}
							/>
						</div>
					)}
					<div className="p-4">
						{previewData.domain && (
							<div className="text-sm text-muted-foreground">
								{previewData.domain}
							</div>
						)}
						{previewData.title && (
							<h4 className="mt-2 text-xl font-semibold text-foreground">
								{previewData.title}
							</h4>
						)}
						{previewData.description && (
							<p className="mt-2 line-clamp-2 text-body-sm text-muted-foreground">
								{previewData.description}
							</p>
						)}
					</div>
				</div>
			)}
		</a>
	)
}
