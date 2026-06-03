import crypto from 'node:crypto'
import { type MdxJsxFlowElement } from 'mdast-util-mdx'
import { bundleMDX } from 'mdx-bundler'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import { type Plugin, type Data } from 'unified'
import { type Node } from 'unist'
import { visit } from 'unist-util-visit'
import { cachified, cache } from './cache.server.ts'
import { prisma } from './db.server.ts'
import { getLinkPreviewForRequest } from './link-preview.server.ts'

const MDX_CACHE_PREFIX = 'mdx:bundle:v3:'

interface DirectiveNode extends Node {
	type: 'leafDirective'
	name: string
	attributes?: { [key: string]: string }
}

interface ImageNode extends Node {
	type: 'image'
	url: string
	alt?: string
	title?: string
}

export async function compileMDX(source: string, opts?: { title?: string }) {
	if (!source) throw new Error('Source is required')

	const hash = crypto.createHash('sha1').update(source).digest('hex')
	const titlePart = opts?.title?.trim() ? opts.title.trim() : 'untitled'
	const key = `${MDX_CACHE_PREFIX}${titlePart}:${hash}`

	return cachified({
		key,
		cache,
		ttl: 1000 * 60 * 60 * 24 * 365, // 1 year
		swr: 1000 * 60 * 60 * 24 * 30, // 30 days
		async getFreshValue() {
			const result = await bundleMDX({
				source,
				mdxOptions(options) {
					options.rehypePlugins = [...(options.rehypePlugins ?? [])]
					options.remarkPlugins = [
						...(options.remarkPlugins ?? []),
						remarkGfm,
						remarkDirective,
						remarkYoutube,
						remarkInlinePreviewData,
						remarkClientOnlyImages,
					]
					return options
				},
			})
			return result
		},
	})
}

const remarkYoutube: Plugin = () => {
	return (tree) => {
		visit(tree, (node: Node<Data>) => {
			if (isDirectiveNode(node) && node.name === 'youtube') {
				const childText =
					Array.isArray((node as any).children) &&
					typeof (node as any).children[0]?.value === 'string'
						? ((node as any).children[0].value as string)
						: null

				const rawValue =
					typeof node.attributes?.id === 'string'
						? node.attributes.id
						: typeof node.attributes?.['#'] === 'string'
							? node.attributes['#']
							: typeof node.attributes?.url === 'string'
								? node.attributes.url
								: typeof node.attributes?.href === 'string'
									? node.attributes.href
									: childText

				const videoId = extractYoutubeId(rawValue)
				if (!videoId) return

				const youtubeNode = node as unknown as MdxJsxFlowElement
				youtubeNode.type = 'mdxJsxFlowElement'
				youtubeNode.name = 'youtube'
				youtubeNode.attributes = [
					{
						type: 'mdxJsxAttribute',
						name: 'id',
						value: videoId,
					},
				] as MdxJsxFlowElement['attributes']
			}
		})
	}
}

const INLINE_PREVIEW_CONCURRENCY = 4

const remarkInlinePreviewData: Plugin = () => {
	return async (tree) => {
		const tasks: Array<() => Promise<void>> = []
		visit(tree, (node: Node<Data>) => {
			if (!(isDirectiveNode(node) && node.name === 'preview')) return

			const url = node.attributes?.url || node.attributes?.['#']
			if (!url || typeof url !== 'string') return

			tasks.push(async () => {
				try {
					// MDX compilation runs in route loaders and should not block on
					// outbound metadata fetches. We read cache immediately and trigger
					// any required refresh in the background.
					const { data: og } = await getLinkPreviewForRequest(url, {
						maxWaitMs: 0,
					})
					if (!og) {
						const previewNode = node as unknown as MdxJsxFlowElement
						previewNode.type = 'mdxJsxFlowElement'
						previewNode.name = 'LinkPreview'
						previewNode.attributes = [
							{ type: 'mdxJsxAttribute', name: 'url', value: String(url) },
						]
						return
					}

					const domainFromUrl = url.startsWith('data:')
						? 'data-url'
						: new URL(url).hostname

					const attrTitle = node.attributes?.title
					const attrDescription = node.attributes?.description
					const attrImage = node.attributes?.image
					const attrDomain = node.attributes?.domain

					const title =
						typeof attrTitle === 'string' && attrTitle.length
							? attrTitle
							: og.title
					const description =
						typeof attrDescription === 'string' && attrDescription.length
							? attrDescription
							: og.description
					const image =
						typeof attrImage === 'string' && attrImage.length
							? attrImage
							: og.image
					const domain =
						typeof attrDomain === 'string' && attrDomain.length
							? attrDomain
							: domainFromUrl

					const previewNode = node as unknown as MdxJsxFlowElement
					previewNode.type = 'mdxJsxFlowElement'
					previewNode.name = 'LinkPreviewStatic'
					previewNode.attributes = [
						{ type: 'mdxJsxAttribute', name: 'url', value: url },
						title
							? { type: 'mdxJsxAttribute', name: 'title', value: title }
							: undefined,
						description
							? {
									type: 'mdxJsxAttribute',
									name: 'description',
									value: description,
								}
							: undefined,
						image
							? { type: 'mdxJsxAttribute', name: 'image', value: image }
							: undefined,
						domain
							? { type: 'mdxJsxAttribute', name: 'domain', value: domain }
							: undefined,
					].filter(Boolean) as MdxJsxFlowElement['attributes']
				} catch {
					const previewNode = node as unknown as MdxJsxFlowElement
					previewNode.type = 'mdxJsxFlowElement'
					previewNode.name = 'LinkPreview'
					previewNode.attributes = [
						{ type: 'mdxJsxAttribute', name: 'url', value: String(url) },
					]
				}
			})
		})
		await runWithLimitedConcurrency(tasks, INLINE_PREVIEW_CONCURRENCY)
	}
}

async function runWithLimitedConcurrency(
	tasks: Array<() => Promise<void>>,
	limit: number,
) {
	if (!tasks.length) return
	const concurrency = Math.max(1, limit)
	const executing = new Set<Promise<void>>()

	for (const task of tasks) {
		const pending = task()
		const wrapped = pending.finally(() => {
			executing.delete(wrapped)
		})
		executing.add(wrapped)
		if (executing.size >= concurrency) {
			await Promise.race(executing)
		}
	}

	await Promise.all(executing)
}

const remarkClientOnlyImages: Plugin = () => {
	return async (tree) => {
		const tasks: Array<Promise<void>> = []
		visit(tree, 'image', (node: ImageNode) => {
			const match = node.url.match(/\/resources\/post-images\/(\w+)/)
			const id = match?.[1]
			const mdxNode = node as unknown as MdxJsxFlowElement
			mdxNode.type = 'mdxJsxFlowElement'
			mdxNode.name = 'MdxImage'
			// Base attributes
			const attrs: MdxJsxFlowElement['attributes'] = [
				{ type: 'mdxJsxAttribute', name: 'src', value: node.url },
				{ type: 'mdxJsxAttribute', name: 'alt', value: node.alt || '' },
			]
			if (node.title)
				attrs.push({
					type: 'mdxJsxAttribute',
					name: 'title',
					value: node.title,
				})

			// Enrich with dimensions if we can look them up
			if (id) {
				tasks.push(
					(async () => {
						try {
							const img = await prisma.postImage.findUnique({
								where: { id },
								select: { width: true, height: true, s3Key: true },
							})
							if (img?.width && img?.height) {
								attrs.push({
									type: 'mdxJsxAttribute',
									name: 'width',
									value: String(img.width),
								})
								attrs.push({
									type: 'mdxJsxAttribute',
									name: 'height',
									value: String(img.height),
								})
							}

							// If we have a public asset base and an s3Key, prefer direct CDN/S3 URL
							const assetBase = process.env.ASSET_BASE_URL?.trim()
							if (assetBase && img?.s3Key) {
								const base = assetBase.replace(/\/$/, '')
								const absolute = `${base}/${img.s3Key}`
								const srcAttr = attrs.find(
									(a) => a.type === 'mdxJsxAttribute' && a.name === 'src',
								) as any
								if (srcAttr) srcAttr.value = absolute
							}
						} catch {
							// ignore
						}
					})(),
				)
			}

			// Default class
			attrs.push({
				type: 'mdxJsxAttribute',
				name: 'className',
				value: 'rounded-md max-w-full',
			})
			mdxNode.attributes = attrs
		})
		await Promise.all(tasks)
	}
}

function isDirectiveNode(node: Node<Data>): node is DirectiveNode {
	return (
		node.type === 'leafDirective' &&
		'name' in node &&
		typeof (node as DirectiveNode).name === 'string'
	)
}

function extractYoutubeId(input: unknown): string | null {
	if (!input || typeof input !== 'string') return null
	const value = input.trim()
	if (!value) return null

	try {
		if (/^https?:\/\//i.test(value)) {
			const url = new URL(value)
			if (url.hostname === 'youtu.be') {
				return url.pathname.split('/').filter(Boolean)[0] ?? null
			}
			if (!url.hostname.includes('youtube')) return null
			const paramId = url.searchParams.get('v')
			if (paramId) return paramId
			const segments = url.pathname.split('/').filter(Boolean)
			if (segments[0] === 'shorts' || segments[0] === 'embed') {
				return segments[1] ?? null
			}
		}
	} catch {
		// ignore malformed URLs, fall back to raw value
	}

	// Fall back to the raw string for cases where the author supplied the id directly.
	return value
}
