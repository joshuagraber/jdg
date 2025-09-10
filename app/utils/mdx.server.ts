import { type MdxJsxFlowElement } from 'mdast-util-mdx'
import crypto from 'node:crypto'
import { bundleMDX } from 'mdx-bundler'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import { type Plugin, type Data } from 'unified'
import { type Node } from 'unist'
import { visit } from 'unist-util-visit'
import { cachified, cache } from './cache.server.ts'

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

export async function compileMDX(source: string) {
    if (!source) throw new Error('Source is required')

    const hash = crypto.createHash('sha1').update(source).digest('hex')
    const key = `mdx:bundle:v1:${hash}`

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
                        remarkPreview,
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

const remarkPreview: Plugin = () => {
	return (tree) => {
		visit(tree, (node: Node<Data>) => {
			if (isDirectiveNode(node) && node.name === 'preview') {
				const url = node.attributes?.url || node.attributes?.['#']

				if (!url) return

				const previewNode = node as unknown as MdxJsxFlowElement
				previewNode.type = 'mdxJsxFlowElement'
				previewNode.name = 'preview'
				previewNode.attributes = [
					{
						type: 'mdxJsxAttribute',
						name: 'url',
						value: url,
					},
				]
			}
		})
	}
}

const remarkClientOnlyImages: Plugin = () => {
	return (tree) => {
		visit(tree, 'image', (node: ImageNode) => {
			const mdxNode = node as unknown as MdxJsxFlowElement
			mdxNode.type = 'mdxJsxFlowElement'
			mdxNode.name = 'ClientOnlyImage'
			mdxNode.attributes = [
				{
					type: 'mdxJsxAttribute',
					name: 'src',
					value: node.url,
				},
				{
					type: 'mdxJsxAttribute',
					name: 'alt',
					value: node.alt || '',
				},
			]

			// Add title attribute if it exists
			if (node.title) {
				mdxNode.attributes.push({
					type: 'mdxJsxAttribute',
					name: 'title',
					value: node.title,
				})
			}

			// Add default className for styling
			mdxNode.attributes.push({
				type: 'mdxJsxAttribute',
				name: 'className',
				value: 'rounded-md max-w-full h-auto',
			})
		})
	}
}

function isDirectiveNode(node: Node<Data>): node is DirectiveNode {
	return (
		node.type === 'leafDirective' &&
		'name' in node &&
		typeof (node as DirectiveNode).name === 'string'
	)
}
