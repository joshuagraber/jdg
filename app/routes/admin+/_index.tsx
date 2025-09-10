import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Link } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { type Route } from './+types/_index'

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserId(request)
}

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export default function Admin() {
	return (
		<div className="container">
			<h1>Admin</h1>
			<p>This is the admin page.</p>

			<div className="flex flex-col">
				<Link to="fragments">Add or update fragments</Link>
				<Link to="cache">Inspect cache</Link>
			</div>
		</div>
	)
}

export const ErrorBoundary = GeneralErrorBoundary
