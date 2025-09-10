import { useEffect, useMemo, useRef, useState } from 'react'
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
	// Track separate state to prevent image flicker
	const [isImageLoaded, setIsImageLoaded] = useState(false)
	const [data, setData] = useState<LinkPreviewData | null>(null)
	const abortRef = useRef<AbortController | null>(null)

	const requestUrl = useMemo(
		() => `/resources/link-preview?url=${encodeURIComponent(url)}`,
		[url],
	)

	useEffect(() => {
		// Abort any in-flight request
		abortRef.current?.abort()
		abortRef.current = new AbortController()

		// Try cache first
		const cached = getCachedPreview(url)
		if (cached) {
			setData(cached)
			return
		}

		const setImageLoading = () => {
			setIsImageLoaded(true)
		}

		// Fetch via window.fetch to bypass Single Fetch .data
		const controller = abortRef.current
		controller?.signal.addEventListener('abort', setImageLoading)
		const timeout = setTimeout(() => controller?.abort(), 6000)
		void (async () => {
			try {
				const res = await fetch(requestUrl, {
					headers: { Accept: 'application/json' },
					signal: controller?.signal,
				})
				if (!res.ok) return
				const json = (await res.json()) as LinkPreviewData
				setData(json)
				setCachedPreview(url, json)
			} catch (error) {
				// ignore (timeout/abort/network)
				console.error('Failed to fetch link preview', { error })
			} finally {
				clearTimeout(timeout)
			}
		})()

		return () => {
			clearTimeout(timeout)
			controller?.abort()
			controller?.signal.removeEventListener('abort', setImageLoading)
		}
	}, [requestUrl, url])

	// set image loading state on timeout if image doesn't load
	// useEffect(() => {
	// 	if (!isImageLoaded) {
	// 		const timeout = setTimeout(() => {
	// 			setIsImageLoaded(true)
	// 		}, 6000)

	// 		return () => clearTimeout(timeout)
	// 	}
	// }, [])

	const isLoading = !isImageLoaded && !data
	const previewData = data

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
