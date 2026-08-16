import { format } from 'date-fns'
import {
	type LoaderFunctionArgs,
	Link,
	Outlet,
	useLoaderData,
} from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { type SEOHandle } from '#app/utils/seo.ts'
import { DeletePost } from './__deleters'
import { PostImageManager } from './__image-manager'
import {
	getPageParam,
	PaginationControls,
} from './__pagination-controls.tsx'
import { PostVideoManager } from './__video-manager'

const POSTS_PAGE_SIZE = 20
const IMAGES_PAGE_SIZE = 12

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	const postsPage = getPageParam(request, 'postsPage')
	const imagesPage = getPageParam(request, 'imagesPage')

	const [posts, postsTotal, images, imagesTotal, videos] = await Promise.all([
		prisma.post.findMany({
			select: {
				id: true,
				title: true,
				slug: true,
				publishAt: true,
				createdAt: true,
				updatedAt: true,
			},
			orderBy: [
				{ publishAt: { sort: 'desc', nulls: 'first' } },
				{ createdAt: 'desc' },
			],
			take: POSTS_PAGE_SIZE,
			skip: (postsPage - 1) * POSTS_PAGE_SIZE,
		}),
		prisma.post.count(),
		prisma.postImage.findMany({
			select: {
				id: true,
				altText: true,
				title: true,
				s3Key: true,
			},
			orderBy: { createdAt: 'desc' },
			take: IMAGES_PAGE_SIZE,
			skip: (imagesPage - 1) * IMAGES_PAGE_SIZE,
		}),
		prisma.postImage.count(),
		await prisma.postVideo.findMany({
			select: {
				id: true,
				altText: true,
				title: true,
			},
			orderBy: { createdAt: 'desc' },
		}),
	])

	return {
		posts,
		postsPagination: {
			page: postsPage,
			pageSize: POSTS_PAGE_SIZE,
			total: postsTotal,
			paramName: 'postsPage',
		},
		images,
		imagesPagination: {
			page: imagesPage,
			pageSize: IMAGES_PAGE_SIZE,
			total: imagesTotal,
			paramName: 'imagesPage',
		},
		videos,
	}
}

export default function AdminPosts() {
	const { posts, postsPagination, images, imagesPagination, videos } =
		useLoaderData<typeof loader>()

	return (
		<div className="p-8">
			<h1 className="font-bold">Manage Posts and Images</h1>
			<Link to="/fragments" prefetch="none">
				View fragments
			</Link>
			<div
				id="admin-posts"
				className="mb-6 scroll-mt-8 flex flex-wrap items-center justify-between"
			>
				<h2>Manage posts</h2>
				<Link
					to="create"
					prefetch="none"
					className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
				>
					New Post
				</Link>
			</div>
			<div className="space-y-4">
				<Outlet />
				<>
					{posts.map((post) => (
						<div
							key={post.id}
							className="flex flex-col items-start justify-between gap-4 rounded-lg border p-4 md:flex-row md:items-center md:gap-0"
						>
							<div>
								<h2 className="text-xl font-semibold">{post.title}</h2>
								<div className="flex gap-2 text-sm text-muted-foreground">
									<span>Created {format(post.createdAt, 'dd MMM yyyy')}</span>
									<span>•</span>
									<span>
										{post.publishAt
											? `Published ${format(post.publishAt, 'dd MMM yyyy, hh:mm aaaa')}`
											: 'Draft'}
									</span>
									<span>•</span>
									<Link to={`/fragments/${post.slug}`} prefetch="none">
										View post
									</Link>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<Button variant="default">
									<Link
										className="text-primary-foreground no-underline hover:text-primary-foreground"
										to={`edit/${post.id}`}
										prefetch="none"
									>
										Edit
									</Link>
								</Button>
								<DeletePost postId={post.id} />
							</div>
						</div>
					))}
				</>
				<PaginationControls
					label="Posts"
					pagination={postsPagination}
					targetId="admin-posts"
				/>
			</div>
			<div>
				<h2>Manage post images</h2>
				<PostImageManager
					images={images}
					pagination={imagesPagination}
					paginationTargetId="admin-images"
				/>

				<h2>Manage post videos</h2>
				<PostVideoManager videos={videos} />
			</div>
		</div>
	)
}
