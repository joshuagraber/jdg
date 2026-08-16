import { Link, useLocation } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'

export type PaginationInfo = {
	page: number
	pageSize: number
	total: number
	paramName: string
}

export function PaginationControls({
	label,
	pagination,
	targetId,
}: {
	label: string
	pagination: PaginationInfo
	targetId?: string
}) {
	const location = useLocation()
	const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
	if (totalPages <= 1) return null

	const previousPage = Math.max(1, pagination.page - 1)
	const nextPage = Math.min(totalPages, pagination.page + 1)
	const canGoPrevious = pagination.page > 1
	const canGoNext = pagination.page < totalPages
	const firstItem = (pagination.page - 1) * pagination.pageSize + 1
	const lastItem = Math.min(pagination.total, pagination.page * pagination.pageSize)

	return (
		<nav
			className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
			aria-label={`${label} pagination`}
		>
			<span>
				{firstItem}-{lastItem} of {pagination.total}
			</span>
			<div className="flex items-center gap-2">
				{canGoPrevious ? (
					<Button asChild type="button" variant="outline" size="sm">
						<Link
							to={getPageHref(
								location.pathname,
								location.search,
								pagination.paramName,
								previousPage,
								targetId,
							)}
							prefetch="none"
						>
							Previous
						</Link>
					</Button>
				) : (
					<Button type="button" variant="outline" size="sm" disabled>
						Previous
					</Button>
				)}
				<span>
					Page {pagination.page} of {totalPages}
				</span>
				{canGoNext ? (
					<Button asChild type="button" variant="outline" size="sm">
						<Link
							to={getPageHref(
								location.pathname,
								location.search,
								pagination.paramName,
								nextPage,
								targetId,
							)}
							prefetch="none"
						>
							Next
						</Link>
					</Button>
				) : (
					<Button type="button" variant="outline" size="sm" disabled>
						Next
					</Button>
				)}
			</div>
		</nav>
	)
}

function getPageHref(
	pathname: string,
	search: string,
	paramName: string,
	page: number,
	targetId?: string,
) {
	const params = new URLSearchParams(search)
	if (page <= 1) {
		params.delete(paramName)
	} else {
		params.set(paramName, String(page))
	}
	const nextSearch = params.toString()
	const hash = targetId ? `#${targetId}` : ''
	return nextSearch ? `${pathname}?${nextSearch}${hash}` : `${pathname}${hash}`
}

export function getPageParam(request: Request, paramName: string) {
	const url = new URL(request.url)
	const rawPage = Number(url.searchParams.get(paramName))
	return Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
}
