import { LinkPreviewStatic } from '../link-preview-static'
import { MdxImage } from '../mdx-image'
import { YouTubeEmbed } from './youtube'

type MDXComponents = {
	youtube: (props: { id: string }) => JSX.Element
	LinkPreviewStatic: (
		props: React.ComponentProps<typeof LinkPreviewStatic>,
	) => JSX.Element
	MdxImage: (props: React.ComponentProps<typeof MdxImage>) => JSX.Element
	// Back-compat for previously compiled content/components
	ClientOnlyImage: (props: React.ComponentProps<typeof MdxImage>) => JSX.Element
}

export const mdxComponents: MDXComponents = {
	// Directive components must match the directive name exactly
	youtube: ({ id }: { id: string }) => {
		return <YouTubeEmbed id={id} />
	},
	LinkPreviewStatic: (props) => <LinkPreviewStatic {...props} />,
	MdxImage: (props) => <MdxImage {...props} />,
	ClientOnlyImage: (props) => <MdxImage {...props} />,
} as const
