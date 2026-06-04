import { invariantResponse } from '@epic-web/invariant'
import { data, type ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const WheelPoemSessionSchema = z.object({
	id: z.string().min(1),
	text: z.string().min(1),
	rotations: z
		.string()
		.transform((value, ctx) => {
			try {
				const parsed = JSON.parse(value)
				if (!Array.isArray(parsed)) {
					throw new Error('Rotations must be an array')
				}
				return parsed
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Invalid rotations payload',
				})
				return z.NEVER
			}
		})
		.pipe(z.array(z.number())),
	wheelSize: z
		.string()
		.optional()
		.transform((value) => {
			if (!value) return null
			const numericValue = Number(value)
			return Number.isFinite(numericValue) ? numericValue : null
		}),
	updatedAt: z.string().transform((value, ctx) => {
		const timestamp = Date.parse(value)
		if (Number.isNaN(timestamp)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Invalid updatedAt timestamp',
			})
			return z.NEVER
		}
		return new Date(timestamp)
	}),
})

export async function action({ request }: ActionFunctionArgs) {
	invariantResponse(request.method === 'POST', 'Method not allowed', {
		status: 405,
		headers: { Allow: 'POST' },
	})

	const formData = await request.formData()
	const submission = WheelPoemSessionSchema.safeParse(
		Object.fromEntries(formData),
	)

	if (!submission.success) {
		console.error('Invalid wheel poem submission', submission.error.flatten())
		return data(
			{ ok: false, error: 'Invalid wheel poem submission' },
			{ status: 400 },
		)
	}

	const { id, text, rotations, wheelSize, updatedAt } = submission.data
	const serializedRotations = JSON.stringify(rotations)

	try {
		await prisma.userCreatedWheelPoem.upsert({
			where: { sessionId: id },
			create: {
				sessionId: id,
				text,
				rotations: serializedRotations,
				wheelSize,
				sessionUpdatedAt: updatedAt,
			},
			update: {
				text,
				rotations: serializedRotations,
				wheelSize,
				sessionUpdatedAt: updatedAt,
			},
		})
	} catch (error) {
		console.error('Failed to persist wheel poem session', error)
		return data({ ok: false, error: 'Unable to save session' }, { status: 500 })
	}

	return data({ ok: true })
}
