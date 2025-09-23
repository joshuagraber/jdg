import { z } from 'zod'

const optionalText = z.preprocess((value) => {
	if (typeof value !== 'string') return value
	return value.trim() === '' ? undefined : value
}, z.string().min(1).optional())

const optionalId = z.preprocess((value) => {
	if (typeof value !== 'string') return value
	const trimmed = value.trim()
	return trimmed === '' ? undefined : trimmed
}, z.string().min(1).optional())

export const PostSchemaCreate = z.object({
	title: z.string().min(1),
	description: z.string().min(1).optional(),
	content: z.string().min(1),
	slug: z.string().min(1).optional(),
	publishAt: z.date().optional().optional(),
	previewTitle: optionalText,
	previewDescription: optionalText,
	previewImageId: optionalId,
})

export const PostSchemaUpdate = z.object({
	title: z.string().min(1),
	description: z.string().min(1).optional(),
	content: z.string().min(1),
	slug: z.string().min(1),
	publishAt: z.date().optional(),
	previewTitle: optionalText,
	previewDescription: optionalText,
	previewImageId: optionalId,
})
