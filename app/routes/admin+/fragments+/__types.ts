import { z } from 'zod'

export const PostSchemaCreate = z.object({
	title: z.string().min(1),
	description: z.string().min(1).optional(),
	content: z.string().min(1),
	slug: z.string().min(1).optional(),
	publishAt: z.date().optional().optional(),
})

export const PostSchemaUpdate = z.object({
	title: z.string().min(1),
	description: z.string().min(1).optional(),
	content: z.string().min(1),
	slug: z.string().min(1),
	publishAt: z.date().optional(),
})
