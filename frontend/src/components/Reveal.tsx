import React from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';

interface RevealProps {
  children: React.ReactNode;
  /** Direction the element animates from (default: 'up'). */
  direction?: RevealDirection;
  /** Delay in ms before the reveal starts — use for staggering (default: 0). */
  delay?: number;
  /** Render as a different element/tag (default: 'div'). */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  /** Threshold for IntersectionObserver (default: 0.15). */
  threshold?: number;
  /** Re-trigger every time it enters the viewport (default: false). */
  repeat?: boolean;
}

const directionClasses: Record<RevealDirection, string> = {
  up: 'reveal-up',
  down: 'reveal-down',
  left: 'reveal-left',
  right: 'reveal-right',
  scale: 'reveal-scale',
  fade: 'reveal-fade',
};

/**
 * Reveal — declarative scroll-triggered animation wrapper.
 *
 * Wraps any content; when it scrolls into view it animates in from the chosen
 * direction. Pairs with the `.reveal-*` + `.reveal-visible` classes in
 * index.css. Respects prefers-reduced-motion (animations are no-ops).
 *
 * Stagger by passing increasing `delay` to siblings:
 *   <Reveal delay={0}>...</Reveal>
 *   <Reveal delay={80}>...</Reveal>
 *   <Reveal delay={160}>...</Reveal>
 */
const Reveal: React.FC<RevealProps> = ({
  children,
  direction = 'up',
  delay = 0,
  as = 'div',
  className = '',
  threshold = 0.15,
  repeat = false,
}) => {
  const Tag = as as React.ElementType;
  const { ref, visible } = useScrollReveal<HTMLDivElement>({
    threshold,
    once: !repeat,
  });

  return (
    <Tag
      ref={ref}
      className={`${directionClasses[direction]} ${visible ? 'reveal-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
