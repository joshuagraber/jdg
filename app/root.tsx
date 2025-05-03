import { withSentry } from '@sentry/remix'
import {
	data,
	Links,
	Meta,
	NavLink,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from 'react-router'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { type Route } from './+types/root'
import appleTouchIconAssetUrl from './assets/favicons/apple-touch-icon.png'
import faviconAssetUrl from './assets/favicons/favicon.svg'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { HashLink } from './components/hash-link.tsx'
import { Progress } from './components/progress-bar.tsx'
import { useToast } from './components/toaster.tsx'
import { href as iconsHref } from './components/ui/icon.tsx'
import { Toaster } from './components/ui/sonner.tsx'
import {
	ThemeSwitch,
	useOptionalTheme,
	useTheme,
} from './routes/resources+/theme-switch.tsx'
import tailwindStyleSheetUrl from './styles/tailwind.css?url'
import { getUserId, logout } from './utils/auth.server.ts'
import { ClientHintCheck, getHints } from './utils/client-hints.tsx'
import { prisma } from './utils/db.server.ts'
import { getEnv } from './utils/env.server.ts'
import { honeypot } from './utils/honeypot.server.ts'
import { cn, combineHeaders, getDomainUrl } from './utils/misc.tsx'
import { useNonce } from './utils/nonce-provider.ts'
import { type Theme, getTheme } from './utils/theme.server.ts'
import { makeTimings, time } from './utils/timing.server.ts'
import { getToast } from './utils/toast.server.ts'
import { useOptionalUser } from './utils/user.ts'
import '@mdxeditor/editor/style.css?url'
;<link
	rel="preload"
	href="/fonts/Inter-Regular.woff2"
	as="font"
	type="font/woff2"
	crossOrigin="anonymous"
/>

export const links: Route.LinksFunction = () => {
	return [
		// Preload svg sprite as a resource to avoid render blocking
		{ rel: 'preload', href: iconsHref, as: 'image' },
		{
			rel: 'icon',
			href: '/favicon.ico',
			sizes: '48x48',
		},
		{ rel: 'icon', type: 'image/svg+xml', href: faviconAssetUrl },
		{ rel: 'apple-touch-icon', href: appleTouchIconAssetUrl },
		{
			rel: 'manifest',
			href: '/site.webmanifest',
			crossOrigin: 'use-credentials',
		} as const, // necessary to make typescript happy
		{ rel: 'stylesheet', href: tailwindStyleSheetUrl },
	].filter(Boolean)
}

export async function loader({ request }: Route.LoaderArgs) {
	const ogURL = new URL(request.url)
	const timings = makeTimings('root loader')
	const userId = await time(() => getUserId(request), {
		timings,
		type: 'getUserId',
		desc: 'getUserId in root',
	})

	const user = userId
		? await time(
				() =>
					prisma.user.findUniqueOrThrow({
						select: {
							id: true,
							name: true,
							username: true,
							image: { select: { id: true } },
							roles: {
								select: {
									name: true,
									permissions: {
										select: { entity: true, action: true, access: true },
									},
								},
							},
						},
						where: { id: userId },
					}),
				{ timings, type: 'find user', desc: 'find user in root' },
			)
		: null
	if (userId && !user) {
		console.info('something weird happened')
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		await logout({ request, redirectTo: '/' })
	}
	const { toast, headers: toastHeaders } = await getToast(request)
	const honeyProps = honeypot.getInputProps()

	return data(
		{
			user,
			requestInfo: {
				hints: getHints(request),
				origin: getDomainUrl(request),
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
				ogURL,
			},
			ENV: getEnv(),
			toast,
			honeyProps,
		},
		{
			headers: combineHeaders(
				{ 'Server-Timing': timings.toString() },
				toastHeaders,
			),
		},
	)
}

export const meta: Route.MetaFunction = ({ data }) => {
	const img =
		data?.requestInfo.hints.theme === 'dark'
			? '/img/jdg_primary_inverted.png'
			: '/img/jdg_primary.png'
	const ogURL = data?.requestInfo.ogURL.toString()
	const imgURL = new URL(img, ogURL).toString()

	return [
		{ title: 'Joshua D. Graber' },
		{
			property: 'description',
			name: 'description',
			content: 'Joshua D. Graber: writing | programming | editing',
		},
		{ property: 'og:title', name: 'og:title', content: 'Joshua D. Graber' },
		{
			property: 'og:description',
			name: 'og:description',
			content: 'Joshua D. Graber: writing | programming | editing',
		},
		{ property: 'og:type', name: 'og:type', content: 'website' },
		{ property: 'og:image', name: 'og:image', content: imgURL },
		{
			property: 'og:image:alt',
			name: 'og:image:alt',
			content: 'Joshua D. Graber',
		},
		{ property: 'og:url', name: 'og:url', content: ogURL },
		{
			property: 'twitter:card',
			name: 'twitter:card',
			content: 'summary_large_image',
		},
		// { name: 'twitter:creator', content: '@joshuagraber' },
		// { name: 'twitter:site', content: '@joshuagraber' },
		{
			name: 'twitter:title',
			property: 'twitter:title',
			content: 'Joshua D. Graber',
		},
		{
			name: 'twitter:description',
			property: 'twitter:description',
			content: 'Joshua D. Graber: writing | programming | editing',
		},
		{ property: 'twitter:image', name: 'twitter:image', content: imgURL },
		{
			property: 'twitter:image:alt',
			name: 'twitter:image:alt',
			content: 'Joshua D. Graber',
		},
		{
			property: 'color-scheme',
			name: 'color-scheme',
			content: 'dark light',
		},
	]
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => {
	const headers = {
		'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
	}
	return headers
}

function Document({
	children,
	nonce,
	theme = 'light',
	env = {},
}: {
	children: React.ReactNode
	nonce: string
	theme?: Theme
	env?: Record<string, string>
}) {
	const allowIndexing = ENV.ALLOW_INDEXING !== 'false'
	return (
		<html lang="en" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				<ClientHintCheck nonce={nonce} />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				{allowIndexing ? null : (
					<meta name="robots" content="noindex, nofollow" />
				)}
				<Meta />
				<Links />
			</head>
			<body className="bg-background text-foreground">
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				<ScrollRestoration   
					getKey={(location, matches) => {
						const paths = ["/fragments"];
						return paths.includes(location.pathname)
							?
								location.pathname + location.search
							: 
								location.key;
					}} 
					nonce={nonce} />
				<Scripts nonce={nonce} />
			</body>
		</html>
	)
}

export function Layout({ children }: { children: React.ReactNode }) {
	// if there was an error running the loader, data could be missing
	const data = useLoaderData<typeof loader>()
	const nonce = useNonce()
	const theme = useOptionalTheme()

	return (
		<Document nonce={nonce} theme={theme} env={data?.ENV}>
			{children}
		</Document>
	)
}

function App() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const theme = useTheme()
	useToast(data.toast)

	return (
		<>
			<div className="flex min-h-screen flex-col justify-between">
				<header className="container py-6">
					<nav className="flex flex-wrap items-center justify-between gap-4 md:gap-8">
						<NavLink
							className={({ isActive }) =>
								`text-body-lg no-underline focus:underline md:text-body-xl hover:underline${isActive ? ' ' + 'text-secondary-foreground' : ''}`
							}
							to="/"
						>
							JDG{' '}
						</NavLink>
						<div className="text-sm [&>*]:no-underline">
							<HashLink
								className="no-underline hover:underline focus:underline md:text-body-md"
								activeClassName="text-secondary-foreground"
								to="/#writing"
							>
								writing
							</HashLink>{' '}
							|{' '}
							<HashLink
								className="no-underline hover:underline focus:underline md:text-body-md"
								activeClassName="text-secondary-foreground"
								to="/#software"
							>
								software
							</HashLink>{' '}
							|{' '}
							<HashLink
								className="no-underline hover:underline focus:underline md:text-body-md"
								activeClassName="text-secondary-foreground"
								to="/#editing"
							>
								editing
							</HashLink>{' '}
							|{' '}
							<NavLink
								className={({ isActive }) =>
									cn(
										'no-underline hover:underline focus:underline md:text-body-md',
										isActive && 'text-secondary-foreground',
									)
								}
								to="fragments"
							>
								fragments
							</NavLink>{' '}
							|{' '}
							<NavLink
								className={({ isActive }) =>
									cn(
										'no-underline hover:underline focus:underline md:text-body-md',
										isActive && 'text-secondary-foreground',
									)
								}
								to="contact"
							>
								contact
							</NavLink>
							{user?.roles.some(({ name }) => name === 'admin') && (
								<>
									{' '}
									|{' '}
									<NavLink
										className={({ isActive }) =>
											cn(
												'no-underline hover:underline focus:underline md:text-body-md',
												isActive && 'text-secondary-foreground',
											)
										}
										to="/admin"
									>
										admin
									</NavLink>
								</>
							)}
						</div>
					</nav>
				</header>

				<div className="flex-1">
					<Outlet />
				</div>

				<div className="container flex justify-between pb-5">
					<ThemeSwitch userPreference={data.requestInfo.userPrefs.theme} />
				</div>
			</div>
			<Toaster closeButton position="top-center" theme={theme} />
			<Progress />
		</>
	)
}

function AppWithProviders() {
	const data = useLoaderData<typeof loader>()
	return (
		<HoneypotProvider {...data.honeyProps}>
			<App />
		</HoneypotProvider>
	)
}

export default withSentry(AppWithProviders)

// this is a last resort error boundary. There's not much useful information we
// can offer at this level.
export const ErrorBoundary = GeneralErrorBoundary
