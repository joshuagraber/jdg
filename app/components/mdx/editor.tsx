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
import { useTheme } from '#app/routes/resources+/theme-switch.tsx'
import { cn } from '#app/utils/misc.tsx'
import { LinkPreview } from '#app/components/link-preview.tsx'

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
						<>
							<UndoRedo />
							<Separator />
							<BoldItalicUnderlineToggles />
							<CodeToggle />
							<Separator />
							<InsertCodeBlock />
							<Separator />
							<StrikeThroughSupSubToggles />
							<Separator />
							<ListsToggle />
							<Separator />
							<BlockTypeSelect />
							<Separator />
								<CreateLink />
								<InsertImage />
								<PreviewButton />
								<YouTubeButton />
								<Separator />
								<InsertTable />
							<InsertThematicBreak />
							<Separator />
						</>
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

    return (
        <DialogButton
            tooltipTitle="Insert Link Preview"
            submitButtonTitle="Insert preview"
            dialogInputPlaceholder="Paste the URL to preview"
            buttonContent="Preview"
            onSubmit={(url) => {
                try {
                    // basic validation
                    const u = new URL(url)
                    if (!/^https?:/.test(u.protocol)) throw new Error('Invalid scheme')
                } catch {
                    alert('Please enter a valid http(s) URL')
                    return
                }

                insertDirective({
                    name: 'preview',
                    type: 'leafDirective',
                    attributes: { url },
                    children: [],
                } as LeafDirective)
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
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
				}}
			>
				<button
					onClick={() => {
						parentEditor.update(() => {
							lexicalNode.selectNext()
							lexicalNode.remove()
						})
					}}
				>
					delete
				</button>
				<iframe
					width="560"
					height="315"
					src={`https://www.youtube.com/embed/${mdastNode.attributes.id}`}
					title="YouTube video player"
					frameBorder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				></iframe>
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
    attributes: ['url'],
    hasChildren: false,
    Editor: ({ mdastNode, lexicalNode, parentEditor }) => {
        const url = mdastNode.attributes.url
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <button
                    onClick={() => {
                        parentEditor.update(() => {
                            lexicalNode.selectNext()
                            lexicalNode.remove()
                        })
                    }}
                >
                    delete
                </button>
                <div style={{ maxWidth: 640 }}>
                    <LinkPreview url={url} />
                </div>
            </div>
        )
    },
}
