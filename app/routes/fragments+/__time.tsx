import { format } from 'date-fns'
import { ClientOnly } from 'remix-utils/client-only'

interface TimeProps extends React.HTMLProps<HTMLTimeElement> {
	time: string
}

export function Time({ time }: TimeProps) {	
	// Use ClientOnly to ensure consistent rendering
	return (
		<ClientOnly fallback={<time dateTime={time}>{null}</time>}>
			{() => {
				const formattedDate = format(new Date(time), 'd MMMM yyyy')

				return <time dateTime={time}>{formattedDate}</time>
				}}
		</ClientOnly>
	)
}
