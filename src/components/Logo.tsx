'use client'

import { useState } from 'react'

/**
 * Renders the shop logo. Prefers /logo.png (drop your exact artwork there to use
 * it), falling back to the bundled /logo.svg recreation, then to nothing.
 */
export default function Logo({ className = '' }: { className?: string }): JSX.Element | null {
  const [src, setSrc] = useState('/logo.png')
  if (src === 'hidden') return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="New Top Ten Plus"
      className={className}
      onError={() => setSrc(src === '/logo.png' ? '/logo.svg' : 'hidden')}
    />
  )
}
