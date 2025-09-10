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
          src={
            (typeof window !== 'undefined' && window.ENV?.ASSET_BASE_URL)
              ? `${window.ENV.ASSET_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`
              : src
          }
          alt={alt}
          title={title}
          className={className}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}
    </ClientOnly>
  )
}
