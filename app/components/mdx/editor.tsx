import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { mdxComponents } from '#app/components/mdx/index.tsx'
import { useMDXComponent } from '#app/components/mdx/runtime.ts'
import { Button } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '#app/components/ui/tooltip.tsx'
import { cn } from '#app/utils/misc.tsx'

type MDXEditorProps = {
	markdown: string
	onChange: (value: string) => void
	className?: string
	diffSource?: string
	images: string[]
	imageUploadHandler: (file: File) => Promise<string>
}

export function MDXEditorComponent({
	markdown,
	onChange,
	className,
	images,
	imageUploadHandler,
}: MDXEditorProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const fileInputId = useId()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const previewFetcher = useFetcher<PreviewResponse>()
	const previewSubmitRef = useRef(previewFetcher.submit)
	const [mode, setMode] = useState<'edit' | 'preview'>('edit')
	const [isUploading, setIsUploading] = useState(false)
	const [previewCode, setPreviewCode] = useState<string | null>(null)
	const [previewError, setPreviewError] = useState<string | null>(null)

	useEffect(() => {
		previewSubmitRef.current = previewFetcher.submit
	}, [previewFetcher.submit])

	useEffect(() => {
		if (previewFetcher.data?.status === 'success') {
			setPreviewCode(previewFetcher.data.code)
			setPreviewError(null)
		} else if (previewFetcher.data?.status === 'error') {
			setPreviewCode(null)
			setPreviewError(previewFetcher.data.message)
		}
	}, [previewFetcher.data])

	useEffect(() => {
		if (mode !== 'preview') return
		const timer = setTimeout(() => {
			const formData = new FormData()
			formData.set('markdown', markdown)
			void previewSubmitRef.current(formData, {
				method: 'POST',
				action: '/admin/fragments/preview',
			})
		}, 300)
		return () => clearTimeout(timer)
	}, [markdown, mode])

	function replaceSelection(
		getNext: (selection: string) => {
			text: string
			selectionStart?: number
			selectionEnd?: number
		},
	) {
		const textarea = textareaRef.current
		if (!textarea) return

		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const selection = markdown.slice(start, end)
		const next = getNext(selection)
		const value = markdown.slice(0, start) + next.text + markdown.slice(end)

		onChange(value)
		window.requestAnimationFrame(() => {
			textarea.focus()
			textarea.setSelectionRange(
				start + (next.selectionStart ?? next.text.length),
				start + (next.selectionEnd ?? next.text.length),
			)
		})
	}

	function wrapSelection(prefix: string, suffix = prefix, fallback = 'text') {
		replaceSelection((selection) => {
			const content = selection || fallback
			return {
				text: `${prefix}${content}${suffix}`,
				selectionStart: prefix.length,
				selectionEnd: prefix.length + content.length,
			}
		})
	}

	function insertBlock(text: string) {
		replaceSelection((selection) => {
			const block = selection ? text.replace('__content__', selection) : text
			const prefix = markdown && !markdown.endsWith('\n') ? '\n\n' : ''
			return { text: `${prefix}${block}\n\n` }
		})
	}

	async function handleUpload(file: File | undefined) {
		if (!file) return
		setIsUploading(true)
		try {
			const url = await imageUploadHandler(file)
			insertImage(url)
		} finally {
			setIsUploading(false)
			if (fileInputRef.current) fileInputRef.current.value = ''
		}
	}

	function insertImage(url: string) {
		replaceSelection((selection) => ({
			text: `![${selection || 'image'}](${url})`,
			selectionStart: 2,
			selectionEnd: 2 + (selection || 'image').length,
		}))
	}

	function insertLink() {
		replaceSelection((selection) => {
			const label = selection || 'link text'
			const url = 'https://'
			return {
				text: `[${label}](${url})`,
				selectionStart: label.length + 3,
				selectionEnd: label.length + 3 + url.length,
			}
		})
	}

	function insertYoutube() {
		const url = window.prompt('YouTube URL or video ID')
		if (!url) return
		insertBlock(`::youtube{url="${url.trim()}"}\n`)
	}

	function insertPreview() {
		const url = window.prompt('Preview URL')
		if (!url) return
		insertBlock(`::preview{url="${url.trim()}"}\n`)
	}

	return (
		<TooltipProvider>
			<div className="overflow-hidden rounded-md bg-background">
				<div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/30 p-2">
					<div className="mr-2 inline-flex rounded-md border border-input bg-background p-0.5">
						<Button
							type="button"
							variant={mode === 'edit' ? 'secondary' : 'ghost'}
							size="sm"
							className="h-8 px-3"
							onClick={() => setMode('edit')}
						>
							Edit
						</Button>
						<Button
							type="button"
							variant={mode === 'preview' ? 'secondary' : 'ghost'}
							size="sm"
							className="h-8 px-3"
							onClick={() => setMode('preview')}
						>
							Preview
						</Button>
					</div>

					<ToolbarButton
						label="Heading"
						onClick={() => insertBlock('## __content__')}
					>
						H2
					</ToolbarButton>
					<ToolbarButton label="Bold" onClick={() => wrapSelection('**')}>
						B
					</ToolbarButton>
					<ToolbarButton label="Italic" onClick={() => wrapSelection('_')}>
						I
					</ToolbarButton>
					<ToolbarButton label="Inline code" onClick={() => wrapSelection('`')}>
						Code
					</ToolbarButton>
					<ToolbarButton label="Link" onClick={insertLink}>
						Link
					</ToolbarButton>
					<ToolbarButton
						label="Bulleted list"
						onClick={() => insertBlock('- __content__')}
					>
						List
					</ToolbarButton>
					<ToolbarButton
						label="Code block"
						onClick={() => insertBlock('```\n__content__\n```')}
					>
						Block
					</ToolbarButton>
					<ToolbarButton
						label="Table"
						onClick={() =>
							insertBlock('| Column | Column |\n| --- | --- |\n| Value | Value |')
						}
					>
						Table
					</ToolbarButton>
					<ToolbarButton label="YouTube" onClick={insertYoutube}>
						YT
					</ToolbarButton>
					<ToolbarButton label="Link preview" onClick={insertPreview}>
						Preview
					</ToolbarButton>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" size="sm" className="h-8">
								Image
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="max-h-72 w-72 overflow-auto"
						>
							{images.length ? (
								images.map((image) => (
									<DropdownMenuItem
										key={image}
										onSelect={() => insertImage(image)}
										className="break-all"
									>
										{image}
									</DropdownMenuItem>
								))
							) : (
								<DropdownMenuItem disabled>No images</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					<input
						ref={fileInputRef}
						id={fileInputId}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={(event) =>
							void handleUpload(event.currentTarget.files?.[0])
						}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8"
						disabled={isUploading}
						onClick={() => fileInputRef.current?.click()}
					>
						{isUploading ? 'Uploading' : 'Upload'}
					</Button>
				</div>

				{mode === 'edit' ? (
					<Textarea
						ref={textareaRef}
						value={markdown}
						onChange={(event) => onChange(event.currentTarget.value)}
						className={cn(
							'min-h-[400px] resize-y rounded-none border-0 font-mono text-sm leading-6 focus-visible:ring-0 focus-visible:ring-offset-0',
							className,
						)}
						spellCheck={false}
					/>
				) : (
					<div className={cn('min-h-[400px] bg-background p-4', className)}>
						{previewFetcher.state !== 'idle' ? (
							<p className="text-sm text-muted-foreground">Rendering preview...</p>
						) : previewError ? (
							<pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
								{previewError}
							</pre>
						) : previewCode ? (
							<div className="jdg_typography max-w-none">
								<MDXPreview code={previewCode} />
							</div>
						) : (
							<p className="text-sm text-muted-foreground">No preview yet.</p>
						)}
					</div>
				)}
			</div>
		</TooltipProvider>
	)
}

function ToolbarButton({
	children,
	label,
	onClick,
}: {
	children: ReactNode
	label: string
	onClick: () => void
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 px-2"
					onClick={onClick}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	)
}

function MDXPreview({ code }: { code: string }) {
	const Component = useMDXComponent(code)
	return <Component components={mdxComponents} />
}

type PreviewResponse =
	| { status: 'success'; code: string }
	| { status: 'error'; message: string }
