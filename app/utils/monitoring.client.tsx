import {
	init as sentryInit,
	browserTracingIntegration,
	replayIntegration,
	browserProfilingIntegration,
} from '@sentry/remix'
import { useEffect } from 'react'
import { useLocation, useMatches } from 'react-router'

export function init() {
	sentryInit({
		dsn: ENV.SENTRY_DSN,
		environment: ENV.MODE,
		release: ENV.COMMIT_SHA,
		beforeSend(event) {
			try {
				const maybeUrl = event.request?.url
				if (!maybeUrl) return event
				// Guard against invalid/relative URLs coming from extensions or SDK internals
				const url = new URL(maybeUrl)
				if (
					url.protocol === 'chrome-extension:' ||
					url.protocol === 'moz-extension:'
				) {
					// This error is from a browser extension, ignore it
					return null
				}
				return event
			} catch {
				// If URL construction fails, keep the event but don't parse the URL
				return event
			}
		},
		integrations: [
			browserTracingIntegration({
				useEffect,
				useLocation,
				useMatches,
			}),
			replayIntegration(),
			browserProfilingIntegration(),
		],

		// Set tracesSampleRate to 1.0 to capture 100%
		// of transactions for performance monitoring.
		// We recommend adjusting this value in production
		tracesSampleRate: .1,

		// Enable browser profiling (percentage of sampled traces)
		profilesSampleRate: .1,

		// Capture Replay for 10% of all sessions,
		// plus for 100% of sessions with an error
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
	})
}
