import { type SEOHandle } from '#app/utils/seo.ts'
import {
	Form,
	redirect,
	useLoaderData,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	Link,
} from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import {
	HOME_LINK_SECTIONS,
	type HomeLinkSection,
} from '#app/utils/home-links.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')

	const links = await prisma.homeLink.findMany({
		orderBy: [{ section: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
	})

	return { links, sections: HOME_LINK_SECTIONS }
}

function parseSection(
	value: FormDataEntryValue | null,
): HomeLinkSection | null {
	if (typeof value !== 'string') return null
	return HOME_LINK_SECTIONS.includes(value as HomeLinkSection)
		? (value as HomeLinkSection)
		: null
}

function parsePosition(value: FormDataEntryValue | null): number {
	if (typeof value !== 'string' || value.trim() === '') return 0
	const n = Number.parseInt(value, 10)
	return Number.isFinite(n) ? n : 0
}

export async function action({ request }: ActionFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'create') {
		const section = parseSection(formData.get('section'))
		const url = formData.get('url')
		const position = parsePosition(formData.get('position'))
		if (!section || typeof url !== 'string' || url.trim() === '') {
			return redirect('/admin/home-links')
		}
		await prisma.homeLink.create({
			data: {
				section,
				url: url.trim(),
				position,
			},
		})
		return redirect('/admin/home-links')
	}

	if (intent === 'update') {
		const id = formData.get('id')
		const section = parseSection(formData.get('section'))
		const url = formData.get('url')
		const position = parsePosition(formData.get('position'))
		if (
			typeof id !== 'string' ||
			!section ||
			typeof url !== 'string' ||
			url.trim() === ''
		) {
			return redirect('/admin/home-links')
		}
		await prisma.homeLink.update({
			where: { id },
			data: {
				section,
				url: url.trim(),
				position,
			},
		})
		return redirect('/admin/home-links')
	}

	if (intent === 'delete') {
		const id = formData.get('id')
		if (typeof id !== 'string') {
			return redirect('/admin/home-links')
		}
		await prisma.homeLink.delete({ where: { id } })
		return redirect('/admin/home-links')
	}

	return redirect('/admin/home-links')
}

export default function AdminHomeLinksRoute() {
	const { links, sections } = useLoaderData<typeof loader>()

	return (
		<div className="container py-8">
			<h1>Manage Home Links</h1>
			<p className="text-muted-foreground">
				Edit homepage and writing publication links in the database.
			</p>
			<p>
				<Link to="/admin">Back to admin</Link>
			</p>

			<h2 className="mt-8">Add link</h2>
			<Form method="post" className="mb-8 flex flex-wrap items-end gap-3">
				<input type="hidden" name="intent" value="create" />
				<label className="flex flex-col gap-1">
					<span>Section</span>
					<select name="section" defaultValue="writing">
						{sections.map((section) => (
							<option key={section} value={section}>
								{section}
							</option>
						))}
					</select>
				</label>
				<label className="flex min-w-[24rem] flex-col gap-1">
					<span>URL</span>
					<input name="url" type="url" required />
				</label>
				<label className="flex w-28 flex-col gap-1">
					<span>Position</span>
					<input name="position" type="number" defaultValue={0} />
				</label>
				<button type="submit">Add</button>
			</Form>

			<h2>Existing links</h2>
			<div className="space-y-3">
				{links.map((link) => (
					<div key={link.id} className="rounded border p-3">
						<Form method="post" className="flex flex-wrap items-end gap-3">
							<input type="hidden" name="intent" value="update" />
							<input type="hidden" name="id" value={link.id} />
							<label className="flex flex-col gap-1">
								<span>Section</span>
								<select name="section" defaultValue={link.section}>
									{sections.map((section) => (
										<option key={section} value={section}>
											{section}
										</option>
									))}
								</select>
							</label>
							<label className="flex min-w-[24rem] flex-col gap-1">
								<span>URL</span>
								<input name="url" type="url" defaultValue={link.url} required />
							</label>
							<label className="flex w-28 flex-col gap-1">
								<span>Position</span>
								<input
									name="position"
									type="number"
									defaultValue={link.position}
								/>
							</label>
							<button type="submit">Save</button>
						</Form>
						<Form method="post" className="mt-2">
							<input type="hidden" name="intent" value="delete" />
							<input type="hidden" name="id" value={link.id} />
							<button type="submit">Delete</button>
						</Form>
					</div>
				))}
			</div>
		</div>
	)
}
