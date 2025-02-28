import { format } from 'date-fns';

export function formatDateStringForPostDefault(date: Date | null) {
	if (!date) return null;
	return format(date.toISOString(), "yyyy-MM-dd'T'HH:mm");
}

export function makePostSlug(title: string, slug?: string) {
	if (slug) return slug

	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}