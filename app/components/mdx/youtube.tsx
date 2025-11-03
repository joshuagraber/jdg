type YouTubeEmbedProps = {
	id: string
	params?: string
}

export const YouTubeEmbed = ({ id }: YouTubeEmbedProps) => {
	return (
		<div className="relative my-2 aspect-video md:my-4">
			<iframe
				className="aspect-video w-full"
				src={`https://www.youtube.com/embed/${id}`}
				title="YouTube video player"
				frameBorder="0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				referrerPolicy="strict-origin-when-cross-origin"
				allowFullScreen
				loading="lazy"
			/>
		</div>
	)
}
