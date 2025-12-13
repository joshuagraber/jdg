import { cn } from '#app/utils/misc.tsx'

export interface LinkPreviewStaticProps {
	url: string
	title?: string
	description?: string
	image?: string
	domain?: string
	className?: string
}

export function LinkPreviewStatic({
	url,
	title,
	description,
	image,
	domain,
	className,
}: LinkPreviewStaticProps) {
	const hasAny = Boolean(title || description || image)

	let fallbackHost: string | null = null
	try {
		fallbackHost = new URL(url).hostname
	} catch {
		fallbackHost = null
	}

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
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
						{fallbackHost ?? 'link'}
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
						{domain && (
							<div className="text-sm text-muted-foreground">{domain}</div>
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
					</div>
				</div>
			)}
		</a>
	)
}
