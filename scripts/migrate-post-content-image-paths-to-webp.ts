#!/usr/bin/env -S tsx
// Load local .env only during development so production
// environments (like Fly) don't require the dotenv package.
if (process.env.NODE_ENV !== 'production') {
	await import('dotenv/config')
}

import { prisma } from '../app/utils/db.server.ts'

const WEBP_CONTENT_TYPE = 'image/webp'
const OLD_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'] as const

type Options = {
	dryRun: boolean
	id?: string
	limit?: number
	touchImagePosts: boolean
}

type Replacement = {
	from: string
	kind: 'literal' | 'without-extension'
	to: string
}

function parseArgs(argv: Array<string>): Options {
	const options: Options = {
		dryRun: false,
		touchImagePosts: false,
	}

	for (const arg of argv) {
		if (arg === '--dry-run') {
			options.dryRun = true
			continue
		}
		if (arg === '--touch-image-posts') {
			options.touchImagePosts = true
			continue
		}
		if (arg.startsWith('--id=')) {
			const id = arg.slice('--id='.length).trim()
			if (!id) throw new Error('--id requires a value')
			options.id = id
			continue
		}
		if (arg.startsWith('--limit=')) {
			const limit = Number(arg.slice('--limit='.length))
			if (!Number.isInteger(limit) || limit < 1) {
				throw new Error('--limit must be a positive integer')
			}
			options.limit = limit
			continue
		}

		throw new Error(`Unknown option: ${arg}`)
	}

	return options
}

function requireEnv() {
	if (!process.env.DATABASE_URL) {
		throw new Error('Missing required env var: DATABASE_URL')
	}
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildKeyReplacementPairs(webpKey: string) {
	if (!webpKey.endsWith('.webp')) return []

	const withoutExtension = webpKey.slice(0, -'.webp'.length)

	const candidates = OLD_IMAGE_EXTENSIONS.flatMap((extension) => [
		`${withoutExtension}.${extension}`,
		`${withoutExtension}.${extension.toUpperCase()}`,
	])

	const replacements: Array<Replacement> = [...new Set(candidates)]
		.filter((candidate) => candidate !== webpKey)
		.map((candidate) => ({
			from: candidate,
			kind: 'literal',
			to: webpKey,
		}))

	replacements.push({
		from: withoutExtension,
		kind: 'without-extension',
		to: webpKey,
	})

	return replacements
}

function replaceAll(value: string, replacement: Replacement) {
	if (replacement.kind === 'literal') {
		return value.replace(
			new RegExp(escapeRegExp(replacement.from), 'g'),
			replacement.to,
		)
	}

	const oldImageExtensionPattern = OLD_IMAGE_EXTENSIONS.join('|')
	return value.replace(
		new RegExp(
			`${escapeRegExp(replacement.from)}(?!\\.(?:webp|${oldImageExtensionPattern})\\b)`,
			'g',
		),
		replacement.to,
	)
}

function hasPostImageReference(content: string) {
	return (
		content.includes('/resources/post-images/') ||
		/images\/[^\s)"']+\.(?:webp|png|jpe?g|gif)/i.test(content)
	)
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	requireEnv()

	const images = await prisma.postImage.findMany({
		where: {
			contentType: WEBP_CONTENT_TYPE,
			s3Key: { endsWith: '.webp' },
		},
		select: { id: true, s3Key: true },
	})
	const replacements = images.flatMap((image) =>
		buildKeyReplacementPairs(image.s3Key).map((replacement) => ({
			imageId: image.id,
			...replacement,
		})),
	)

	if (!replacements.length) {
		console.log('No migrated WebP image keys found to map from PNG paths.')
		await prisma.$disconnect()
		return
	}

	const posts = await prisma.post.findMany({
		where: {
			...(options.id ? { id: options.id } : {}),
		},
		select: {
			id: true,
			slug: true,
			content: true,
		},
		take: options.limit,
		orderBy: { createdAt: 'asc' },
	})

	const mode = options.dryRun ? 'dry run' : 'write'
	console.log(
		`Checking ${posts.length} posts against ${replacements.length} image path replacements (${mode})`,
	)
	if (options.limit) {
		console.log(`Limit applied: ${options.limit} posts`)
	}

	let checked = 0
	let touched = 0
	let updated = 0
	let unchanged = 0

	for (const post of posts) {
		checked += 1
		let nextContent = post.content
		const matched = new Set<string>()

		for (const replacement of replacements) {
			if (!nextContent.includes(replacement.from)) continue
			nextContent = replaceAll(nextContent, replacement)
			matched.add(replacement.imageId)
		}

		const shouldTouch =
			options.touchImagePosts && hasPostImageReference(post.content)

		if (nextContent === post.content && !shouldTouch) {
			unchanged += 1
			continue
		}

		if (nextContent === post.content) {
			touched += 1
			console.log(`${post.id} (${post.slug}): touching image-bearing post`)
		} else {
			updated += 1
			console.log(
				`${post.id} (${post.slug}): ${matched.size} image path replacement${
					matched.size === 1 ? '' : 's'
				}`,
			)
		}

		if (!options.dryRun) {
			await prisma.post.update({
				where: { id: post.id },
				data:
					nextContent === post.content
						? { updatedAt: new Date() }
						: { content: nextContent },
			})
		}
	}

	console.log(
		`Done. Checked: ${checked}. Updated: ${updated}. Touched: ${touched}. Unchanged: ${unchanged}.`,
	)
	await prisma.$disconnect()
}

main().catch(async (error) => {
	console.error(error)
	await prisma.$disconnect()
	process.exit(1)
})
