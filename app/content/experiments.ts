export type ExperimentPreviewConfig = {
	to: string
	url: string
	title: string
	description: string
	imageAlt: string
	images?: {
		light: string
		dark: string
	}
}

export const WHEEL_POEM_LINK_PREVIEW = {
	to: '/experiments/wheel-poem',
	url: '/experiments/wheel-poem',
	title: 'Wheel Poem Experiment',
	description:
		'Generate aleatory poetry by distributing any text across spinning concentric wheels.',
	imageAlt: 'Wheel Poem experiment interface preview',
	images: {
		light: '/img/wheel-poem-preview_light.webp',
		dark: '/img/wheel-poem-preview_dark.webp',
	},
} satisfies ExperimentPreviewConfig

export const MATHEWS_ALGORITHM_LINK_PREVIEW = {
	to: '/experiments/mathews-algorithm',
	url: '/experiments/mathews-algorithm',
	title: "Mathews' Algorithm Experiment",
	description:
		'Build equivalent sets, apply Harry Mathews-inspired cyclic shifts, and read the generated combinations.',
	imageAlt: "Mathews' Algorithm experiment interface preview",
	images: {
		light: '/img/mathews-preview_light.webp',
		dark: '/img/mathews-preview_dark.webp',
	},
} satisfies ExperimentPreviewConfig

export const HOME_EXPERIMENT_PREVIEWS: ReadonlyArray<ExperimentPreviewConfig> = [
	WHEEL_POEM_LINK_PREVIEW,
	MATHEWS_ALGORITHM_LINK_PREVIEW,
]
