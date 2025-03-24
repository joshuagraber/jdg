import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import * as E from '@react-email/components'
import { useActionData, Form, data } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { TextareaField, Field } from '#app/components/forms'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { sendEmail } from '#app/utils/email.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/contact'

const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(1, 'Message is required'),
})

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: ContactFormSchema })

  if (submission.status !== 'success') {
    return data(
      { result: submission.reply() },
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const { name, email, message } = submission.value
  const to = process.env.JDG_CONTACT_SEND_TO

  if (!to) {
    throw new Error('Contact email address is not configured')
  }

  await sendEmail({
    to,
    subject: `New Contact Form Submission from ${name}`,
    react: <ContactEmail name={name} email={email} message={message}/>
  })

  return redirectWithToast('/', {
    type: 'success',
    title: 'Message sent',
    description:
      "Thank you for saying hello. I'll get back to you as quickly as possible.",
  })
}

export default function ContactRoute() {
  const actionData = useActionData()
  const isPending = useIsPending()
  const [form, fields] = useForm({
    id: 'verify-form',
    constraint: getZodConstraint(ContactFormSchema),
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ContactFormSchema })
    },
  })

  return (
    <div className="container pb-32 pt-20">
      <h1>Say hello</h1>
      <Form method="POST" {...getFormProps(form)} className="flex-1">
        <HoneypotInputs />
        <Field
          labelProps={{
            htmlFor: fields.name.id,
            children: 'What is your name?',
          }}
          inputProps={{
            ...getInputProps(fields.name, { type: 'text' }),
            autoComplete: 'name',
            autoFocus: true,
          }}
          errors={fields.name.errors}
        />
        <Field
          labelProps={{
            htmlFor: fields.email.id,
            children: 'What is your email address?',
          }}
          inputProps={{
            ...getInputProps(fields.email, { type: 'email' }),
            autoComplete: 'email',
          }}
          errors={fields.email.errors}
        />
        <TextareaField
          labelProps={{
            htmlFor: fields.message.id,
            children: 'What is your comment or question?',
          }}
          textareaProps={{
            ...getTextareaProps(fields.message),
            autoComplete: 'off',
            rows: 5,
          }}
          errors={fields.message.errors}
        />
        <StatusButton
          className="w-full"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Submit
        </StatusButton>
      </Form>
    </div>
  )
}

function ContactEmail({ name, email, message }: { name: string, email: string, message: string }) {
  return (
    <E.Html lang="en" dir="ltr">
      <E.Container>
        <h1>
          <E.Text>New message from joshuadgraber.com</E.Text>
        </h1>
        <p>
          <E.Text>
            <strong>Name:</strong> {name}
          </E.Text>
        </p>
        <p>
          <E.Text>
            <strong>Email:</strong> {email}
          </E.Text>
        </p>
        <p>
          <E.Text>
            <p>
              <strong>Message:</strong>
            </p>
            <p>{message}</p>
          </E.Text>
        </p>
      </E.Container>
    </E.Html>
  )
}
