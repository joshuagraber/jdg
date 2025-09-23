import { type Params } from 'react-router'

export type InternalLinkPreviewData = {
	url: string
	title?: string | null
	description?: string | null
	image?: string | null
	domain?: string | null
}

export type LinkPreviewHandleContext = {
	params: Params<string>
	request: Request
}

export type LinkPreviewHandle = {
	linkPreview?: (
		context: LinkPreviewHandleContext,
	) => Promise<InternalLinkPreviewData | null> | InternalLinkPreviewData | null
}

export type InternalLinkPreviewMap = Record<string, InternalLinkPreviewData>
