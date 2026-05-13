import {
	getFormProps,
	getInputProps,
	getTextareaProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type SEOHandle } from '#app/utils/seo.ts'
import React from 'react'
import {
	data,
	type ActionFunctionArgs,
	type MetaFunction,
	Form,
	Link,
	useActionData,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { toast as showToast } from 'sonner'
import { z } from 'zod'
import {
	CheckboxField,
	ErrorList,
	Field,
	OTPField,
	TextareaField,
} from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '#app/components/ui/tooltip.tsx'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()

	checkHoneypot(formData)

	const submission = await parseWithZod(formData, {
		schema: TestSchema,
		async: true,
	})

	try {
		console.log('form action', { submission })
		if (submission.status !== 'success') {
			return data(
				{ result: submission.reply() },
				{ status: submission.status === 'error' ? 400 : 200 },
			)
		}
		return { result: submission.reply() }
	} catch (response: any) {
		return data(
			{
				result: submission.reply({ formErrors: [response.error.message] }),
			},
			{
				status: 500,
			},
		)
	}
}

export const meta: MetaFunction = () => {
	return [{ title: 'Test components | JDG' }]
}

const TestSchema = z.object({
	name: z.string().min(2),
	iceCream: z.enum(['on']).optional(),
	favorites: z.string(),
	code: z.string().min(6).max(6),
})

export default function TestComponents() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	// const [searchParams] = useSearchParams()
	// const redirectTo = searchParams.get('redirectTo')

	const [form, fields] = useForm({
		id: 'test-form',
		constraint: getZodConstraint(TestSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			const result = parseWithZod(formData, { schema: TestSchema })
			return result
		},
		shouldRevalidate: 'onBlur',
	})

	React.useEffect(() => {
		showToast.success('test success', { duration: 60000 })
		showToast.info('test into', { duration: 60000 })
		showToast.error('test error', { duration: 60000 })
	}, [])

	return (
		<div className="p-6">
			<h1>Test and re-style components</h1>
			<h2>Forms</h2>
			<Form method="POST" {...getFormProps(form)}>
				<HoneypotInputs />
				<Field
					labelProps={{
						htmlFor: fields.name.id,
						children: 'Name',
					}}
					inputProps={{
						...getInputProps(fields.name, { type: 'text' }),
						autoComplete: 'name',
					}}
					errors={fields.name.errors}
				/>
				<CheckboxField
					labelProps={{
						htmlFor: fields.iceCream.id,
						children: 'Do you like ice cream?',
					}}
					buttonProps={{
						...getInputProps(fields.iceCream, { type: 'checkbox' }),
					}}
					errors={fields.iceCream.errors}
				/>
				<TextareaField
					labelProps={{ children: 'Favorite flavors?' }}
					textareaProps={{
						...getTextareaProps(fields.favorites),
					}}
					errors={fields.favorites.errors}
				/>
				<OTPField
					labelProps={{
						htmlFor: fields.code.id,
						children: 'Code',
					}}
					inputProps={{
						...getInputProps(fields.code, { type: 'text' }),
						autoFocus: true,
						autoComplete: 'one-time-code',
					}}
					errors={fields.code.errors}
				/>

				<ErrorList errors={form.errors} id={form.errorId} />
				<StatusButton
					className="w-full"
					status={isPending ? 'pending' : (form.status ?? 'idle')}
					type="submit"
					disabled={isPending}
				>
					Submit
				</StatusButton>
			</Form>

			<Spacer size="2xs" />

			<h2>Buttons</h2>
			<h3>Status buttons</h3>
			<div className="flex gap-3">
				<StatusButton status="error">Error</StatusButton>
				<StatusButton status="pending">Pending</StatusButton>
				<StatusButton status="idle">Idle</StatusButton>
				<StatusButton status="success">Success</StatusButton>
			</div>

			<Spacer size="2xs" />

			<h3>Variant buttons</h3>
			<div className="flex gap-3">
				<Button variant="default">Default</Button>
				<Button variant="destructive">Destructive</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="link">Link</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="secondary">Secondary</Button>
			</div>

			<Spacer size="2xs" />

			<h2>Tooltip</h2>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Tooltip trigger</TooltipTrigger>
					<TooltipContent>Tooltip content</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<Spacer size="2xs" />
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<span>
							Tooltip trigger (as child)
							<Icon name="check" />
						</span>
					</TooltipTrigger>
					<TooltipContent>Tooltip content</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<Spacer size="2xs" />

			<h2>Other Colors</h2>
			<div className="border-2 border-solid">Border</div>
			<div className="bg-accent text-accent-foreground">Accent</div>
			<div className="bg-secondary text-secondary-foreground">Secondary</div>
			<div className="bg-primary text-primary-foreground">Primary</div>
			<div className="bg-destructive text-destructive-foreground">
				Destructive
			</div>
			<div className="bg-foreground-destructive">Foreground destructive</div>
			<div className="bg-muted text-muted-foreground">Muted</div>
			<div className="bg-card text-card-foreground">Card</div>
			<div className="bg-popover text-popover-foreground">Popover</div>
			<div className="bg-input">Input</div>
			<div className="bg-background">Background</div>
			<div className="bg-primary text-primary-foreground">Primary</div>

			<Spacer size="xs" />

			<h2>Miscellaneous</h2>

			<div className="flex flex-col">
				<h3>Headings</h3>

				<h1>This is an h1 by default</h1>
				<h2>This is an h2 by default</h2>
				<h3>This is an h3 by default</h3>
				<h4>This is an h4 by default</h4>
				<h5>This is an h5 by default</h5>
				<h6>This is an h6 by default</h6>
			</div>

			<div className="mt-6 flex flex-col">
				<h3>Links</h3>
				<Link to="/">This is how a link is styled</Link>
				<Link to="/">Another one for seeing the difference</Link>
			</div>

			<div>
				<h3>Mono</h3>

				<pre>{JSON.stringify({ foo: 'bar', baz: 'buzz' }, null, 2)}</pre>
			</div>

			<div className="mt-6 flex flex-col gap-6 sm:flex-row sm:flex-wrap">
				<h2 className="w-full">Theme color palate</h2>
				<div>
					{new Array(5).fill(null).map((_, i) => {
						return (
							<div className="flex items-center gap-2" key={i}>
								<div
									className="h-20 w-20"
									style={{
										backgroundColor: `hsl(var(--neutral-${i}))`,
									}}
								/>
								<p>{`neutral-${i}`}</p>
							</div>
						)
					})}
				</div>

				<div>
					{new Array(10).fill(null).map((_, i) => {
						return (
							<div className="flex items-center gap-2" key={i}>
								<div
									className="h-20 w-20"
									style={{
										backgroundColor: `hsl(var(--theme-${i}))`,
									}}
								/>
								<p>{`theme-${i}`}</p>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
