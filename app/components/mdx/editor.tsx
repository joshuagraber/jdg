import {
	MDXEditor,
	headingsPlugin,
	listsPlugin,
	quotePlugin,
	thematicBreakPlugin,
	markdownShortcutPlugin,
	linkPlugin,
	linkDialogPlugin,
	tablePlugin,
	codeBlockPlugin,
	codeMirrorPlugin,
	diffSourcePlugin,
	frontmatterPlugin,
	toolbarPlugin,
	UndoRedo,
	BoldItalicUnderlineToggles,
	BlockTypeSelect,
	CodeToggle,
	CreateLink,
	InsertTable,
	InsertThematicBreak,
	InsertImage,
	InsertCodeBlock,
	ListsToggle,
	DiffSourceToggleWrapper,
	StrikeThroughSupSubToggles,
	imagePlugin,
	directivesPlugin,
	type DirectiveDescriptor,
	AdmonitionDirectiveDescriptor,
	usePublisher,
	DialogButton,
	insertDirective$,
	ConditionalContents,
	ChangeCodeMirrorLanguage,
	Separator,
} from '@mdxeditor/editor'
import { type LeafDirective } from 'mdast-util-directive'
import { useRef } from 'react'
import { ClientOnly } from 'remix-utils/client-only'
import { LinkPreviewStatic } from '#app/components/link-preview-static.tsx'
import { LinkPreview } from '#app/components/link-preview.tsx'
import { useTheme } from '#app/routes/resources+/theme-switch.tsx'
import { cn } from '#app/utils/misc.tsx'

type MDXEditorProps = {
	markdown: string
	onChange: (value: string) => void
	className?: string
	diffSource?: string
	images: string[]
	imageUploadHandler: (file: File) => Promise<string>
}

const Toolbar = () => (
	<DiffSourceToggleWrapper>
		<ConditionalContents
			options={[
				{
					when: (editor) => editor?.editorType === 'codeblock',
					contents: () => <ChangeCodeMirrorLanguage />,
				},
				{
					fallback: () => (
						<div className="mdx-toolbar">
							{/* History Controls */}
							<div className="mdx-toolbar-group">
								<UndoRedo />
							</div>
							<Separator />

							{/* Text Formatting */}
							<div className="mdx-toolbar-group">
								<BoldItalicUnderlineToggles />
								<CodeToggle />
								<StrikeThroughSupSubToggles />
							</div>
							<Separator />

							{/* Block Formatting */}
							<div className="mdx-toolbar-group">
								<BlockTypeSelect />
								<ListsToggle />
							</div>
							<Separator />

							{/* Code & Structure */}
							<div className="mdx-toolbar-group">
								<InsertCodeBlock />
								<InsertThematicBreak />
							</div>
							<Separator />

							{/* Media & Links */}
							<div className="mdx-toolbar-group">
								<CreateLink />
								<InsertImage />
							</div>
							<Separator />

							{/* Rich Content */}
							<div className="mdx-toolbar-group">
								<PreviewButton />
								<YouTubeButton />
							</div>
							<Separator />

							{/* Tables */}
							<div className="mdx-toolbar-group">
								<InsertTable />
							</div>
						</div>
					),
				},
			]}
		></ConditionalContents>
	</DiffSourceToggleWrapper>
)

export function MDXEditorComponent({
	markdown,
	onChange,
	className,
	diffSource,
	images = [],
	imageUploadHandler,
}: MDXEditorProps) {
	const editorRef = useRef(null)
	const theme = useTheme()

	return (
		<ClientOnly fallback={null}>
			{() => {
				return (
					<MDXEditor
						className={cn(
							// TODO: Remove the typography plugin (https://github.com/tailwindlabs/tailwindcss-typography) when global typography styles updated
							'jdg_typography min-h-[400px] w-full',
							className,
							theme === 'dark' && 'dark-theme dark-editor',
						)}
						ref={editorRef}
						markdown={markdown}
						onChange={onChange}
						plugins={[
							toolbarPlugin({
								toolbarContents: () => <Toolbar />,
							}),
							listsPlugin(),
							quotePlugin(),
							headingsPlugin({ allowedHeadingLevels: [2, 3, 4, 5, 6] }),
							linkPlugin(),
							linkDialogPlugin(),
							imagePlugin({
								imageAutocompleteSuggestions: images,
								imageUploadHandler,
							}),
							tablePlugin(),
							thematicBreakPlugin(),
							frontmatterPlugin(),
							codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
							codeMirrorPlugin({
								codeBlockLanguages: {
									js: 'JavaScript',
									css: 'CSS',
									txt: 'Plain Text',
									tsx: 'TypeScript',
									'': 'Unspecified',
								},
							}),
							directivesPlugin({
								directiveDescriptors: [
									YoutubeDirectiveDescriptor,
									PreviewDirectiveDescriptor,
									AdmonitionDirectiveDescriptor,
								],
							}),
							diffSourcePlugin({
								viewMode: 'source',
								diffMarkdown: diffSource,
							}),
							markdownShortcutPlugin(),
						]}
					/>
				)
			}}
		</ClientOnly>
	)
}

const YouTubeButton = () => {
	// grab the insertDirective action (a.k.a. publisher) from the
	// state management system of the directivesPlugin
	const insertDirective = usePublisher(insertDirective$)

	return (
		<DialogButton
			tooltipTitle="Insert Youtube video"
			submitButtonTitle="Insert video"
			dialogInputPlaceholder="Paste the youtube video URL"
			buttonContent="YT"
			onSubmit={(url) => {
				const videoId = new URL(url).searchParams.get('v')
				if (videoId) {
					insertDirective({
						name: 'youtube',
						type: 'leafDirective',
						attributes: { id: videoId },
						children: [],
					} as LeafDirective)
				} else {
					alert('Invalid YouTube URL')
				}
			}}
		/>
	)
}

const PreviewButton = () => {
	const insertDirective = usePublisher(insertDirective$)

	// Load recent URLs from localStorage for autocomplete
	let recentSuggestions: string[] = []
	try {
		const raw =
			typeof window !== 'undefined'
				? localStorage.getItem('jdg:preview:recent')
				: null
		recentSuggestions = raw ? (JSON.parse(raw) as string[]) : []
	} catch {
		recentSuggestions = []
	}

	return (
		<DialogButton
			tooltipTitle="Insert Link Preview"
			submitButtonTitle="Insert preview"
			dialogInputPlaceholder="Paste the URL to preview"
			buttonContent="Preview"
			autocompleteSuggestions={recentSuggestions}
			onSubmit={(url) => {
				try {
					const u = new URL(url)
					if (!/^https?:/.test(u.protocol)) throw new Error('Invalid scheme')
				} catch {
					alert('Please enter a valid http(s) URL')
					return
				}

				// Optional overrides
				const title =
					window.prompt(
						'Optional title override (leave blank to auto-fetch):',
					) || ''
				const description =
					window.prompt(
						'Optional description override (leave blank to auto-fetch):',
					) || ''
				const image =
					window.prompt(
						'Optional image URL override (leave blank to auto-fetch):',
					) || ''
				const domain =
					window.prompt(
						'Optional domain override (leave blank to auto-detect):',
					) || ''

				const attributes: Record<string, string> = { url }
				if (title.trim()) attributes.title = title.trim()
				if (description.trim()) attributes.description = description.trim()
				if (image.trim()) attributes.image = image.trim()
				if (domain.trim()) attributes.domain = domain.trim()

				insertDirective({
					name: 'preview',
					type: 'leafDirective',
					attributes,
					children: [],
				} as LeafDirective)

				// Persist recent URL for autocomplete
				try {
					const raw = localStorage.getItem('jdg:preview:recent')
					const list: string[] = raw ? (JSON.parse(raw) as string[]) : []
					const next = [url, ...list.filter((u) => u !== url)].slice(0, 15)
					localStorage.setItem('jdg:preview:recent', JSON.stringify(next))
				} catch {
					// ignore
				}
			}}
		/>
	)
}

interface YoutubeDirectiveNode extends LeafDirective {
	name: 'youtube'
	attributes: { id: string }
}

const YoutubeDirectiveDescriptor: DirectiveDescriptor<YoutubeDirectiveNode> = {
	name: 'youtube',
	type: 'leafDirective',
	testNode(node) {
		return node.name === 'youtube'
	},
	attributes: ['id'],
	hasChildren: false,
	Editor: ({ mdastNode, lexicalNode, parentEditor }) => {
		return (
			<div className="mdx-directive-container">
				<div className="mdx-directive-controls">
					<button
						className="mdx-delete-button"
						onClick={() => {
							parentEditor.update(() => {
								lexicalNode.selectNext()
								lexicalNode.remove()
							})
						}}
						title="Delete YouTube video"
					>
						🗑️
					</button>
				</div>
				<div className="mdx-directive-content">
					<iframe
						width="560"
						height="315"
						src={`https://www.youtube.com/embed/${mdastNode.attributes.id}`}
						title="YouTube video player"
						frameBorder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					></iframe>
				</div>
			</div>
		)
	},
}

interface PreviewDirectiveNode extends LeafDirective {
	name: 'preview'
	attributes: { url: string }
}

const PreviewDirectiveDescriptor: DirectiveDescriptor<PreviewDirectiveNode> = {
	name: 'preview',
	type: 'leafDirective',
	testNode(node) {
		return node.name === 'preview'
	},
	attributes: ['url', 'title', 'description', 'image', 'domain'],
	hasChildren: false,
	Editor: ({ mdastNode, lexicalNode, parentEditor }) => {
		const url = mdastNode.attributes.url
		const title = (mdastNode as any).attributes?.title as string | undefined
		const description = (mdastNode as any).attributes?.description as
			| string
			| undefined
		const image = (mdastNode as any).attributes?.image as string | undefined
		const domain = (mdastNode as any).attributes?.domain as string | undefined
		return (
			<div className="mdx-directive-container">
				<div className="mdx-directive-controls">
					<button
						className="mdx-delete-button"
						onClick={() => {
							parentEditor.update(() => {
								lexicalNode.selectNext()
								lexicalNode.remove()
							})
						}}
						title="Delete link preview"
					>
						🗑️
					</button>
				</div>
				<div className="mdx-directive-content">
					<div className="mdx-link-preview-container">
						{title || description || image || domain ? (
							<LinkPreviewStatic
								url={url}
								title={title}
								description={description}
								image={image}
								domain={domain}
							/>
						) : (
							<LinkPreview url={url} />
						)}
					</div>
				</div>
			</div>
		)
	},
}
