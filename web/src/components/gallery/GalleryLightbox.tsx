/**
 * Gallery lightbox overlay — full-res image viewer with keyboard navigation.
 * Renders when open || closing to allow exit animation before unmount.
 */

import { useCallback, useEffect, useState } from 'react'

export interface LightboxImage {
  src: string
  alt: string
  title?: string
  tags?: string[]
}

export interface GalleryLightboxProps {
  images: LightboxImage[]
  initialIndex: number
  open: boolean
  onClose: () => void
}

export default function GalleryLightbox({
  images,
  initialIndex,
  open: openProp,
  onClose: onCloseProp,
}: GalleryLightboxProps) {
  const [open, setOpen] = useState(openProp)
  const [closing, setClosing] = useState(false)
  const [index, setIndex] = useState(initialIndex)

  // Listen for gallery:open-lightbox custom event from Astro page
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ index: number }>).detail
      setIndex(detail.index)
      setOpen(true)
      setClosing(false)
    }
    window.addEventListener('gallery:open-lightbox', handler)
    return () => window.removeEventListener('gallery:open-lightbox', handler)
  }, [])

  // Sync with prop changes
  useEffect(() => {
    if (openProp) {
      setOpen(true)
      setClosing(false)
      setIndex(initialIndex)
    }
  }, [openProp, initialIndex])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      setOpen(false)
      onCloseProp()
    }, 200)
  }, [onCloseProp])

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }, [images.length])

  const goNext = useCallback(() => {
    setIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, handleClose, goPrev, goNext])

  if (!open && !closing) return null

  const image = images[index]
  if (!image) return null

  const isOpen = open && !closing

  return (
    <>
      <style>{`
        @keyframes lbOverlayIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes lbOverlayOut {
          from { opacity: 1 }
          to { opacity: 0 }
        }
        @keyframes lbImageIn {
          from { opacity: 0; transform: scale(0.92) }
          to { opacity: 1; transform: scale(1) }
        }
        @keyframes lbImageOut {
          from { opacity: 1; transform: scale(1) }
          to { opacity: 0; transform: scale(0.92) }
        }
        .lb-overlay {
          animation: ${isOpen ? 'lbOverlayIn' : 'lbOverlayOut'} 0.2s ease both;
        }
        .lb-content {
          animation: ${isOpen
            ? 'lbImageIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'lbImageOut 0.2s ease'} both;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="lb-overlay fixed inset-0 z-[2000] flex items-center justify-center"
        style={{ background: 'var(--overlay-bg)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose()
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="neu-btn fixed top-4 right-4 z-[2001]
                     flex items-center justify-center w-12 h-12 rounded-full
                     text-[var(--text-secondary)]
                     transition-all duration-200"
          aria-label="关闭"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Navigation: prev */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev() }}
            className="neu-btn fixed left-4 top-1/2 z-[2001] -translate-y-1/2
                       flex items-center justify-center w-12 h-12 rounded-full
                       text-[var(--text-secondary)]
                       transition-all duration-200"
            aria-label="上一张"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Navigation: next */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext() }}
            className="neu-btn fixed right-4 top-1/2 z-[2001] -translate-y-1/2
                       flex items-center justify-center w-12 h-12 rounded-full
                       text-[var(--text-secondary)]
                       transition-all duration-200"
            aria-label="下一张"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Image + info */}
        <div className="lb-content flex flex-col items-center gap-4 max-w-[90vw] max-h-[85vh]">
          <img
            src={image.src}
            alt={image.alt}
            className="max-w-full max-h-[75vh] rounded-lg object-contain select-none"
          />
          {(image.title || (image.tags && image.tags.length > 0)) && (
            <div className="flex flex-col items-center gap-2">
              {image.title && (
                <span className="text-white text-lg font-semibold">{image.title}</span>
              )}
              {image.tags && image.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {image.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 text-xs text-white/80 rounded-full
                                 bg-white/15"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Counter */}
          {images.length > 1 && (
            <span className="text-sm text-white/50">
              {index + 1} / {images.length}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
