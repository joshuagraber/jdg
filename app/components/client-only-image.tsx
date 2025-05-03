import { ClientOnly } from 'remix-utils/client-only'

interface ClientOnlyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  title?: string
  className?: string
}

export function ClientOnlyImage({
  src,
  alt,
  title,
  className = '',
  ...props
}: ClientOnlyImageProps) {
  return (
    <ClientOnly fallback={null}>
      {() => (
        <img
          src={src}
          alt={alt}
          title={title}
          className={className}
          loading="lazy"
          {...props}
        />
      )}
    </ClientOnly>
  )
}