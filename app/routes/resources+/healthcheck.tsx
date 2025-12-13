// Shallow liveness check: fast and reliable for Fly health checks
export async function loader() {
	return new Response('OK')
}
