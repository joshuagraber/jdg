import { format } from 'date-fns'
import { ClientOnly } from 'remix-utils/client-only'

type TimeFormat = 'date' | 'dateTime'

interface TimeProps
	extends Omit<React.TimeHTMLAttributes<HTMLTimeElement>, 'dateTime'> {
	time: string | Date
	formatStyle?: TimeFormat
}

function getDateTimeValue(time: string | Date) {
	return time instanceof Date ? time.toISOString() : time
}

function formatTime(date: Date, formatStyle: TimeFormat) {
	if (formatStyle === 'dateTime') {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(date)
	}

	return format(date, 'd MMMM yyyy')
}

export function Time({ time, formatStyle = 'date', ...props }: TimeProps) {
	const dateTime = getDateTimeValue(time)

	return (
		<ClientOnly fallback={<time dateTime={dateTime} {...props}>{null}</time>}>
			{() => {
				const date = new Date(dateTime)
				const formattedDate = Number.isNaN(date.getTime())
					? dateTime
					: formatTime(date, formatStyle)

				return (
					<time dateTime={dateTime} {...props}>
						{formattedDate}
					</time>
				)
			}}
		</ClientOnly>
	)
}
