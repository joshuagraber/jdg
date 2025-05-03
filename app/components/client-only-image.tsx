'use client'

import { useState, useEffect } from 'react'

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
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    // Return a placeholder with the same dimensions to prevent layout shift
    return (
      <div 
        className={`bg-secondary/30 animate-pulse ${className}`}
        style={{ aspectRatio: '16/9' }}
        title={title || alt}
        aria-label={alt}
        role="img"
        {...props}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      title={title}
      className={className}
      loading="lazy"
      {...props}
    />
  )
}