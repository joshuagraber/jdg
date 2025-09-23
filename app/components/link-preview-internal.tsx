import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { type InternalLinkPreviewData } from '#app/utils/link-preview'
import { cn } from '#app/utils/misc.tsx'

interface InternalLinkPreviewProps {
	to: string
	data: InternalLinkPreviewData
	className?: string
	prefetch?: 'none' | 'intent'
	meta?: ReactNode
}

export function InternalLinkPreview({
	to,
	data,
	className,
	prefetch = 'intent',
	meta,
}: InternalLinkPreviewProps) {
	const { title, description, image, domain, url } = data
	const hasAny = Boolean(title || description || image)
	const isInternal = url.startsWith('/')
	let fallbackLabel: string | null = null

	if (!domain && !isInternal) {
		try {
			const resolved = new URL(url, 'https://example.com')
			fallbackLabel =
				resolved.hostname === 'example.com' ? null : resolved.hostname
		} catch {
			fallbackLabel = null
		}
	}

	const domainLabel = !isInternal ? (domain ?? fallbackLabel) : null

	return (
		<Link
			to={to}
			prefetch={prefetch}
			className={cn(
				'jdg-link-preview',
				'group block cursor-pointer overflow-hidden rounded-md border border-primary no-underline transition-shadow focus:border-secondary-foreground',
				className,
				!hasAny && 'h-80 sm:h-44',
			)}
		>
			{!hasAny ? (
				<div className="flex h-full w-full items-center justify-center bg-secondary p-4 dark:bg-secondary/30">
					<span className="text-sm text-muted-foreground">
						{domain ?? fallbackLabel ?? 'link'}
					</span>
				</div>
			) : (
				<div className="flex flex-col sm:flex-row">
					{image && (
						<div className="h-44 flex-shrink-0 sm:h-44 sm:w-44">
							<img
								src={image}
								alt={title || ''}
								className="h-full w-full object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100"
								loading="lazy"
							/>
						</div>
					)}
					<div className="p-4">
						{domainLabel && (
							<div className="text-sm text-muted-foreground">{domainLabel}</div>
						)}
						{title && (
							<h4 className="mt-2 text-xl font-semibold text-foreground">
								{title}
							</h4>
						)}
						{description && (
							<p className="mt-2 line-clamp-2 text-body-sm text-muted-foreground">
								{description}
							</p>
						)}
						{meta && (
							<div className="mt-3 text-sm text-muted-foreground">{meta}</div>
						)}
					</div>
				</div>
			)}
		</Link>
	)
}
