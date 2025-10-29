import { Outlet, type LoaderFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return null
}

export default function AdminUserCreatedLayoutRoute() {
	return <Outlet />
}
