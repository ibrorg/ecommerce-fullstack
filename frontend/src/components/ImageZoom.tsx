import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FiX, FiZoomIn, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface ImageZoomProps {
  src: string;
  alt: string;
  // optional: gallery images for the lightbox navigation
  images?: string[];
  // optional: current index for lightbox nav
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
}

/**
 * ImageZoom — hover-to-magnify product image with a click-to-open fullscreen
 * lightbox. On desktop the image scales up and tracks the cursor for a
 * magnifier effect; on touch devices the lightbox is the primary affordance.
 */
const ImageZoom: React.FC<ImageZoomProps> = ({
  src,
  alt,
  images,
  currentIndex = 0,
  onIndexChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const gallery = images && images.length > 0 ? images : [src];

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }, []);

  const handleEnter = () => setZoomed(true);
  const handleLeave = () => setZoomed(false);

  const openLightbox = () => setLightboxOpen(true);
  const closeLightbox = () => setLightboxOpen(false);

  const goPrev = useCallback(() => {
    if (!onIndexChange) return;
    onIndexChange((currentIndex - 1 + gallery.length) % gallery.length);
  }, [currentIndex, gallery.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (!onIndexChange) return;
    onIndexChange((currentIndex + 1) % gallery.length);
  }, [currentIndex, gallery.length, onIndexChange]);

  // keyboard nav in lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, goPrev, goNext]);

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onMouseMove={handleMouseMove}
        onClick={openLightbox}
        className={`relative overflow-hidden cursor-zoom-in ${className}`}
      >
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-200"
          style={
            zoomed
              ? {
                  transform: 'scale(2)',
                  transformOrigin: `${position.x}% ${position.y}%`,
                }
              : undefined
          }
        />
        {/* zoom hint badge */}
        <div className="absolute bottom-3 right-3 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-semibold backdrop-blur-sm">
            <FiZoomIn size={12} />
            Hover to zoom
          </span>
        </div>
      </div>

      {/* lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <FiX size={24} />
          </button>

          {/* prev / next only when multiple images */}
          {gallery.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Previous"
                className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <FiChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Next"
                className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <FiChevronRight size={28} />
              </button>
            </>
          )}

          <img
            src={gallery[currentIndex]}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* counter */}
          {gallery.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
              {currentIndex + 1} / {gallery.length}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ImageZoom;
