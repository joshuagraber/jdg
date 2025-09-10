// Readiness check: verify DB and loopback
import { type LoaderFunctionArgs } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
  const host = request.headers.get('X-Forwarded-Host') ?? request.headers.get('host')
  try {
    await Promise.all([
      prisma.user.count(),
      fetch(`${new URL(request.url).protocol}//${host}`, {
        method: 'HEAD',
        headers: { 'X-Healthcheck': 'true' },
      }).then((r) => {
        if (!r.ok) return Promise.reject(r)
      }),
    ])
    return new Response('OK')
  } catch (error: unknown) {
    console.log('readiness ❌', { error })
    return new Response('ERROR', { status: 500 })
  }
}

