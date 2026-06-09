import { invariantResponse } from '@epic-web/invariant'
import { data, type ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const MathewsAlgorithmSessionSchema = z.object({
	id: z.string().min(1),
	size: z.string().transform((value, ctx) => {
		const size = Number(value)
		if (!Number.isInteger(size) || size < 2 || size > 10) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Invalid table size',
			})
			return z.NEVER
		}
		return size
	}),
	table: z
		.string()
		.transform((value, ctx) => {
			try {
				const parsed = JSON.parse(value)
				if (!Array.isArray(parsed)) {
					throw new Error('Table must be an array')
				}
				return parsed
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Invalid table payload',
				})
				return z.NEVER
			}
		})
		.pipe(z.array(z.array(z.string()))),
	shiftPasses: z.string().transform((value, ctx) => {
		const shiftPasses = Number(value)
		if (!Number.isInteger(shiftPasses) || shiftPasses < 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Invalid shift passes',
			})
			return z.NEVER
		}
		return shiftPasses
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
	const submission = MathewsAlgorithmSessionSchema.safeParse(
		Object.fromEntries(formData),
	)

	if (!submission.success) {
		console.error(
			'Invalid Mathews algorithm submission',
			submission.error.flatten(),
		)
		return data(
			{ ok: false, error: 'Invalid Mathews algorithm submission' },
			{ status: 400 },
		)
	}

	const { id, size, table, shiftPasses, updatedAt } = submission.data
	const serializedTable = JSON.stringify(table)

	try {
		await prisma.userCreatedMathewsAlgorithm.upsert({
			where: { sessionId: id },
			create: {
				sessionId: id,
				size,
				table: serializedTable,
				shiftPasses,
				sessionUpdatedAt: updatedAt,
			},
			update: {
				size,
				table: serializedTable,
				shiftPasses,
				sessionUpdatedAt: updatedAt,
			},
		})
	} catch (error) {
		console.error('Failed to persist Mathews algorithm session', error)
		return data({ ok: false, error: 'Unable to save session' }, { status: 500 })
	}

	return data({ ok: true })
}
