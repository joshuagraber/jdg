import { createId as cuid } from '@paralleldrive/cuid2'
import { redirect } from 'react-router'
import { GitHubStrategy } from 'remix-auth-github'
import { z } from 'zod'
import { cache, cachified } from '../cache.server.ts'
import { connectionSessionStorage } from '../connections.server.ts'
import { type Timings } from '../timing.server.ts'
import { MOCK_CODE_GITHUB_HEADER, MOCK_CODE_GITHUB } from './constants.ts'
import { type AuthProvider } from './provider.ts'

const GitHubUserSchema = z.object({ login: z.string() })
const GitHubUserParseResult = z
	.object({
		success: z.literal(true),
		data: GitHubUserSchema,
	})
	.or(
		z.object({
			success: z.literal(false),
		}),
	)

const shouldMock =
	process.env.GITHUB_CLIENT_ID?.startsWith('MOCK_') ||
	process.env.NODE_ENV === 'test'

export class GitHubProvider implements AuthProvider {
	getAuthStrategy() {
		return new GitHubStrategy(
			{
				clientId: process.env.GITHUB_CLIENT_ID ?? '',
				clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
				redirectURI: new URL(
					'/auth/github/callback',
					process.env.SITE_URL ?? 'http://localhost:3000',
				).toString(),
			},
			// @ts-expect-error - TODO: figure this out when needed.
			async ({ profile }) => {
				// TODO: figure this new api out when needed
				return {
					id: profile.id,
					email: profile.emails?.[0]?.value,
					username: profile.displayName || profile.username,
					// ... other user fields
				}
			},
		)
	}

	async resolveConnectionData(
		providerId: string,
		{ timings }: { timings?: Timings } = {},
	) {
		const result = await cachified({
			key: `connection-data:github:${providerId}`,
			cache,
			timings,
			ttl: 1000 * 60,
			swr: 1000 * 60 * 60 * 24 * 7,
			async getFreshValue(context) {
				const response = await fetch(
					`https://api.github.com/user/${providerId}`,
					{ headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } },
				)
				const rawJson = await response.json()
				const result = GitHubUserSchema.safeParse(rawJson)
				if (!result.success) {
					// if it was unsuccessful, then we should kick it out of the cache
					// asap and try again.
					context.metadata.ttl = 0
				}
				return result
			},
			checkValue: GitHubUserParseResult,
		})
		return {
			displayName: result.success ? result.data.login : 'Unknown',
			link: result.success ? `https://github.com/${result.data.login}` : null,
		} as const
	}

	async handleMockAction(request: Request) {
		if (!shouldMock) return

		const connectionSession = await connectionSessionStorage.getSession(
			request.headers.get('cookie'),
		)
		const state = cuid()
		connectionSession.set('oauth2:state', state)

		// allows us to inject a code when running e2e tests,
		// but falls back to a pre-defined 🐨 constant
		const code =
			request.headers.get(MOCK_CODE_GITHUB_HEADER) || MOCK_CODE_GITHUB
		const searchParams = new URLSearchParams({ code, state })
		throw redirect(`/auth/github/callback?${searchParams}`, {
			headers: {
				'set-cookie':
					await connectionSessionStorage.commitSession(connectionSession),
			},
		})
	}
}
