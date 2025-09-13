import { LinkPreviewStatic } from '../link-preview-static'
import { ClientOnlyImage } from '../client-only-image'
import { YouTubeEmbed } from './youtube'

type MDXComponents = {
	youtube: (props: { id: string }) => JSX.Element
	LinkPreviewStatic: (
		props: React.ComponentProps<typeof LinkPreviewStatic>,
	) => JSX.Element
	ClientOnlyImage: (
		props: React.ComponentProps<typeof ClientOnlyImage>,
	) => JSX.Element
}

export const mdxComponents: MDXComponents = {
	// Directive components must match the directive name exactly
	youtube: ({ id }: { id: string }) => {
		return <YouTubeEmbed id={id} />
	},
	LinkPreviewStatic: (props) => <LinkPreviewStatic {...props} />,
	// Client-only image component for markdown images
	ClientOnlyImage: (props) => {
		return <ClientOnlyImage {...props} />
	},
} as const
