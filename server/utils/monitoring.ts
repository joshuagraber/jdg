import { nodeProfilingIntegration } from '@sentry/profiling-node'
import Sentry from '@sentry/remix'

export function init() {
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.NODE_ENV,
		release: process.env.COMMIT_SHA,
		tracesSampleRate: process.env.NODE_ENV === 'production' ? 1 : 0,
		autoInstrumentRemix: true,
		denyUrls: [
			/\/resources\/healthcheck/,
			// TODO: be smarter about the public assets...
			/\/build\//,
			/\/favicons\//,
			/\/img\//,
			/\/fonts\//,
			/\/favicon.ico/,
			/\/site\.webmanifest/,
		],
		integrations: [
			Sentry.httpIntegration(),
			Sentry.prismaIntegration(),
			nodeProfilingIntegration(),
		],
		// Enable Node.js profiling (percentage of sampled traces)
		profilesSampleRate: .1,
		tracesSampler(samplingContext) {
			// ignore healthcheck transactions by other services (consul, etc.)
			if (samplingContext.request?.url?.includes('/resources/healthcheck')) {
				return 0
			}
			return 1
		},
		beforeSendTransaction(event) {
			// ignore all healthcheck related transactions
			//  note that name of header here is case-sensitive
			if (event.request?.headers?.['x-healthcheck'] === 'true') {
				return null
			}

			return event
		},
	})
}
