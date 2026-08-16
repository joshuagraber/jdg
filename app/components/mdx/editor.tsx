import { Textarea } from '#app/components/ui/textarea.tsx'
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
}: MDXEditorProps) {
	return (
		<Textarea
			value={markdown}
			onChange={(event) => onChange(event.currentTarget.value)}
			className={cn(
				'min-h-[400px] resize-y font-mono text-sm leading-6',
				className,
			)}
			spellCheck={false}
		/>
	)
}
