import * as Sentry from '@sentry/remix'
import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'
import { init as initMonitoring } from './utils/monitoring.client.tsx'

if (ENV.MODE === 'production' && ENV.SENTRY_DSN) {
	initMonitoring()
}

startTransition(() => {
	hydrateRoot(document, <HydratedRouter />, {
		onRecoverableError(error, errorInfo) {
			if (ENV.MODE !== 'production' || !ENV.SENTRY_DSN) return

			Sentry.withScope((scope) => {
				scope.setTag('react.error_type', 'recoverable')
				scope.setContext('react.recoverable_error', {
					componentStack: errorInfo.componentStack,
				})
				Sentry.captureException(error)
			})
		},
	})
})
