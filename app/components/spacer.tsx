import { cn } from '#app/utils/misc.tsx'

export function Spacer({
	size,
}: {
	/**
	 * The size of the space
	 *
	 * 4xs: h-4 (16px)
	 *
	 * 3xs: h-8 (32px)
	 *
	 * 2xs: h-12 (48px)
	 *
	 * xs: h-16 (64px)
	 *
	 * sm: h-20 (80px)
	 *
	 * md: h-24 (96px)
	 *
	 * lg: h-28 (112px)
	 *
	 * xl: h-32 (128px)
	 *
	 * 2xl: h-36 (144px)
	 *
	 * 3xl: h-40 (160px)
	 *
	 * 4xl: h-44 (176px)
	 */
	size:
	  | '5xs'
		| '4xs'
		| '3xs'
		| '2xs'
		| 'xs'
		| 'sm'
		| 'md'
		| 'lg'
		| 'xl'
		| '2xl'
		| '3xl'
		| '4xl'
}) {
	const options: Record<typeof size, string> = {
		'5xs': 'h-2 md:h-3',
		'4xs': 'h-3 md:h-4',
		'3xs': 'h-6 md:h-8',
		'2xs': 'h-8 md:h-12',
		xs: 'h-12 md:h-16',
		sm: 'h-16 md:h-20',
		md: 'h-20 md:h-24',
		lg: 'h-24 md:h-28',
		xl: 'h-26 md:h-32',
		'2xl': 'h-28 md:h-36',
		'3xl': 'h-32 md:h-40',
		'4xl': 'h-38 md:h-44',
	}
	const className = options[size]
	return <span className={cn(className, 'block')} />
}
