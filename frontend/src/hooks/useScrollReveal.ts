import { useEffect, useRef, useState } from 'react';

interface UseScrollRevealOptions {
  /** Trigger only once when the element enters the viewport (default: true). */
  once?: boolean;
  /** Viewport intersection ratio that fires the reveal (default: 0.15). */
  threshold?: number;
  /** Root margin — negative top delays the trigger until scrolled further in (default: '0px 0px -10% 0px'). */
  rootMargin?: string;
}

/**
 * useScrollReveal — IntersectionObserver-powered reveal trigger.
 *
 * Returns a ref to attach to any element and a boolean `visible` that flips to
 * `true` once the element scrolls into view. Respects prefers-reduced-motion
 * (the hook still fires, but the CSS disables the actual animation).
 *
 * Usage:
 *   const { ref, visible } = useScrollReveal();
 *   <div ref={ref} className={visible ? 'reveal-visible' : 'reveal'} />
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {},
) {
  const { once = true, threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = options;
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // If IntersectionObserver is unavailable (SSR / very old browsers), just show.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, threshold, rootMargin]);

  return { ref, visible };
}
