export type ExperimentPreviewConfig = {
	to: string
	url: string
	title: string
	description: string
	imageAlt: string
	images: {
		light: string
		dark: string
	}
}

export const WHEEL_POEM_LINK_PREVIEW: ExperimentPreviewConfig = {
	to: '/experiments/wheel-poem',
	url: '/experiments/wheel-poem',
	title: 'Wheel Poem Experiment',
	description:
		'Generate aleatory poetry by distributing any text across spinning concentric wheels.',
	imageAlt: 'Wheel Poem experiment interface preview',
	images: {
		light: '/img/wheel-poem-preview_light.png',
		dark: '/img/wheel-poem-preview_dark.png',
	},
}

export const HOME_EXPERIMENT_PREVIEWS = [WHEEL_POEM_LINK_PREVIEW] as const
