import { useState } from 'react'
import { cn } from '#app/utils/misc.tsx'

type MdxImageProps = {
	src: string
	alt?: string
	title?: string
	className?: string
	width?: number | string
	height?: number | string
}

export function MdxImage({
	src,
	alt = '',
	title,
	className,
	width,
	height,
}: MdxImageProps) {
	// Compute aspect ratio if we have numeric width/height
	const w = typeof width === 'string' ? Number(width) : width
	const h = typeof height === 'string' ? Number(height) : height
	const hasAspect = Boolean(w && h)
	const aspect = hasAspect ? `${w} / ${h}` : undefined

	// Client-side loaded state for fade-in and shimmer removal
	const [loaded, setLoaded] = useState(false)

	// Optionally prefix with ASSET_BASE_URL on the client; on the server, keep relative
	const resolvedSrc = src

	return (
		<div
			className={cn('relative w-full overflow-hidden rounded-md', className)}
			style={aspect ? { aspectRatio: aspect } : undefined}
		>
			{/* Shimmer placeholder */}
			<div
				className={cn(
					'absolute inset-0 animate-pulse bg-secondary/50 dark:bg-secondary/20',
					loaded && 'hidden',
				)}
			/>
			<img
				src={resolvedSrc}
				alt={alt}
				title={title}
				className={cn(
					hasAspect ? 'h-full w-full object-contain' : 'h-auto w-full',
					'opacity-0 transition-opacity duration-300',
					loaded && 'opacity-100',
				)}
				{...(w && h ? { width: w, height: h } : {})}
				loading="lazy"
				decoding="async"
				onLoad={() => setLoaded(true)}
			/>
		</div>
	)
}
