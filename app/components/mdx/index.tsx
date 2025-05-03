import { LinkPreview } from '../link-preview'
import { ClientOnlyImage } from '../client-only-image'
import { YouTubeEmbed } from './youtube'

type MDXComponents = {
	youtube: (props: { id: string }) => JSX.Element
	preview: (props: { url: string }) => JSX.Element
	ClientOnlyImage: (props: React.ComponentProps<typeof ClientOnlyImage>) => JSX.Element
}

export const mdxComponents: MDXComponents = {
	// Directive components must match the directive name exactly
	youtube: ({ id }: { id: string }) => {
		return <YouTubeEmbed id={id} />
	},
	preview: ({ url }: { url: string }) => {
		return <LinkPreview url={url} />
	},
	// Client-only image component for markdown images
	ClientOnlyImage: (props) => {
		return <ClientOnlyImage {...props} />
	},
} as const
