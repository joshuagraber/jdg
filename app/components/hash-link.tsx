import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { cn } from '#app/utils/misc.tsx'

export function HashLink({
	to,
	children,
	activeClassName,
	className,
}: {
	activeClassName: string | undefined
	className?: string
	to: string
	children: ReactNode
}) {
	const location = useLocation()
	const isActive = location.hash.split('#')[1] === to.split('#')[1]

	return (
		<Link to={to} className={cn(className, isActive ? activeClassName : '')}>
			{children}
		</Link>
	)
}
