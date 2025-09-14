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
import { getOpenGraphData } from './link-preview.server.ts'

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
    const key = `mdx:bundle:${titlePart}:${hash}`

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
				const id =
					node.attributes?.id ||
					(node.attributes?.['#'] ? node.attributes['#'] : null)

				if (!id) return

				const youtubeNode = node as unknown as MdxJsxFlowElement
				youtubeNode.type = 'mdxJsxFlowElement'
				youtubeNode.name = 'youtube'
				youtubeNode.attributes = [
					{
						type: 'mdxJsxAttribute',
						name: 'id',
						value: id,
					},
				]
			}
		})
	}
}

const remarkInlinePreviewData: Plugin = () => {
    return async (tree) => {
        const tasks: Array<Promise<void>> = []
        visit(tree, (node: Node<Data>) => {
            if (!(isDirectiveNode(node) && node.name === 'preview')) return

            const url = node.attributes?.url || node.attributes?.['#']
            if (!url || typeof url !== 'string') return

            tasks.push(
                (async () => {
                    try {
                        const og = await cachified({
                            key: `link-preview:${url}`,
                            cache,
                            ttl: 1000 * 60 * 60 * 24, // 24h
                            swr: 1000 * 60 * 60 * 24 * 7, // 7d
                            async getFreshValue() {
                                return await getOpenGraphData(url)
                            },
                        })

                        const domainFromUrl = url.startsWith('data:')
                            ? 'data-url'
                            : new URL(url).hostname

                        const attrTitle = node.attributes?.title
                        const attrDescription = node.attributes?.description
                        const attrImage = node.attributes?.image
                        const attrDomain = node.attributes?.domain

                        const title = typeof attrTitle === 'string' && attrTitle.length ? attrTitle : og.title
                        const description =
                            typeof attrDescription === 'string' && attrDescription.length
                                ? attrDescription
                                : og.description
                        const image = typeof attrImage === 'string' && attrImage.length ? attrImage : og.image
                        const domain = typeof attrDomain === 'string' && attrDomain.length ? attrDomain : domainFromUrl

                        const previewNode = node as unknown as MdxJsxFlowElement
                        previewNode.type = 'mdxJsxFlowElement'
                        previewNode.name = 'LinkPreviewStatic'
                        previewNode.attributes = [
                            { type: 'mdxJsxAttribute', name: 'url', value: url },
                            title
                                ? { type: 'mdxJsxAttribute', name: 'title', value: title }
                                : undefined,
                            description
                                ? { type: 'mdxJsxAttribute', name: 'description', value: description }
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
                        previewNode.name = 'LinkPreviewStatic'
                        previewNode.attributes = [
                            { type: 'mdxJsxAttribute', name: 'url', value: String(url) },
                        ]
                    }
                })(),
            )
        })
        await Promise.all(tasks)
    }
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
            if (node.title) attrs.push({ type: 'mdxJsxAttribute', name: 'title', value: node.title })

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
                                attrs.push({ type: 'mdxJsxAttribute', name: 'width', value: String(img.width) })
                                attrs.push({ type: 'mdxJsxAttribute', name: 'height', value: String(img.height) })
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
