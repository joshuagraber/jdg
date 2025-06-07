import { Link, useSearchParams } from 'react-router';
import { Icon } from '#app/components/ui/icon.tsx'
import { cn } from '#app/utils/misc.tsx'
import { setSearchParamsString } from './__util'
import { POSTS_PER_PAGE } from './_index'

const paginationButtonClasses =
	'text-primary border border-input bg-background hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground h-8 w-8 rounded-md flex items-center justify-center no-underline cursor-pointer'
const paginationButtonDisabledClasses = 'pointer-events-none opacity-50'

export function PaginationBar({ total }: { total: number }) {
	const [searchParams] = useSearchParams()
	const skip = Number(searchParams.get('skip')) || 0
	const top = Number(searchParams.get('top')) || POSTS_PER_PAGE

	const totalPages = Math.ceil(total / top)
	const currentPage = Math.floor(skip / top) + 1
	const maxPages = 3
	const halfMaxPages = Math.floor(maxPages / 2)
	const canPageBackwardsBy = (skip - 0) / top
	const canPageForwardsBy = total - (skip + top)

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
						skip: 0,
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					canPageBackwardsBy < 2 && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> First page</span>
				<Icon name="double-arrow-left" />
			</Link>

			<Link
				to={{
					search: setSearchParamsString(searchParams, {
						skip: Math.max(skip - top, 0),
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					canPageBackwardsBy < 1 && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> Previous page</span>
				<Icon name="arrow-left" />
			</Link>

			{pageNumbers.map((pageNumber) => {
				const pageSkip = (pageNumber - 1) * top
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
									skip: pageSkip,
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
						skip: skip + top,
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					canPageForwardsBy < 1 && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> Next page</span>
				<Icon name="arrow-right" />
			</Link>
			<Link
				to={{
					search: setSearchParamsString(searchParams, {
						skip: (totalPages - 1) * top,
					}),
				}}
				preventScrollReset
				prefetch="intent"
				className={cn(
					paginationButtonClasses,
					canPageForwardsBy < 2 && paginationButtonDisabledClasses,
				)}
			>
				<span className="sr-only"> Last page</span>
				<Icon name="double-arrow-right" />
			</Link>
		</div>
	)
}
