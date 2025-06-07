import { Link, useSearchParams } from 'react-router';
import { Icon } from '#app/components/ui/icon.tsx'
import { cn } from '#app/utils/misc.tsx'
import { setSearchParamsString } from './__util'
import { POSTS_PER_PAGE } from './_index'

const paginationButtonClasses =
	'text-primary border border-input bg-background hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground h-8 w-8 rounded-md flex items-center justify-center no-underline cursor-pointer'
const paginationButtonDisabledClasses = 'pointer-events-none opacity-50'

export function PaginationBar({ 
	total, 
	currentPage, 
	nextCursor, 
	hasNextPage, 
	hasPrevPage 
}: { 
	total: number; 
	currentPage: number;
	nextCursor?: string | null;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}) {
	const [searchParams] = useSearchParams()
	const top = Number(searchParams.get('top')) || POSTS_PER_PAGE

	const totalPages = Math.ceil(total / top)
	const maxPages = 3
	const halfMaxPages = Math.floor(maxPages / 2)

	const pages = maxPages < totalPages ? maxPages : totalPages
	const pageNumbers = [] as Array<number>

	if (currentPage <= halfMaxPages) {
		for (let i = 1; i <= pages; i++) {
			pageNumbers.push(i)
		}
	} else if (currentPage >= totalPages - halfMaxPages) {
		for (let i = totalPages - pages + 1; i <= totalPages; i++) {
			pageNumbers.push(i)
		}
	} else {
		for (
			let i = currentPage - halfMaxPages;
			i <= currentPage + halfMaxPages;
			i++
		) {
			pageNumbers.push(i)
		}
	}

	if (total < top) return null

	return (
		<div className="mx-auto flex items-center gap-1">
			<Link
				to={{
					search: setSearchParamsString(searchParams, {
						page: 1,
						cursor: undefined,
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					!hasPrevPage && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> First page</span>
				<Icon name="double-arrow-left" />
			</Link>

			<Link
				to={{
					search: setSearchParamsString(searchParams, {
						page: Math.max(currentPage - 1, 1),
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					!hasPrevPage && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> Previous page</span>
				<Icon name="arrow-left" />
			</Link>

			{pageNumbers.map((pageNumber) => {
				const isCurrentPage = pageNumber === currentPage
				if (isCurrentPage) {
					return (
						<div
							key={`${pageNumber}-active`}
							className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-primary text-primary-foreground"
						>
							<div>
								<span className="sr-only">Page {pageNumber}</span>
								<span>{pageNumber}</span>
							</div>
						</div>
					)
				} else {
					return (
						<Link
							key={pageNumber}
							to={{
								search: setSearchParamsString(searchParams, {
									page: pageNumber,
								}),
							}}
							preventScrollReset
							prefetch="intent"
							className={paginationButtonClasses}
						>
							{pageNumber}
						</Link>
					)
				}
			})}
			<Link
				to={{
					search: setSearchParamsString(searchParams, {
						page: currentPage + 1,
						...(nextCursor ? { cursor: nextCursor } : {}),
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					!hasNextPage && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> Next page</span>
				<Icon name="arrow-right" />
			</Link>
			<Link
				to={{
					search: setSearchParamsString(searchParams, {
						page: totalPages,
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					currentPage >= totalPages && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> Last page</span>
				<Icon name="double-arrow-right" />
			</Link>
		</div>
	)
}
