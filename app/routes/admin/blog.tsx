import { Outlet } from '@remix-run/react';

export default function BlogAdmin() {
	return (
		<div>
			<h2>Hello from BlogAdmin</h2>
			<Outlet />
		</div>
	);
}
