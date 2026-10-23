import React from 'react';

interface SkeletonProps {
  className?: string;
  // "rect" (default), "circle", or "text" — just sizing hints
  variant?: 'rect' | 'circle' | 'text';
  // repeat the skeleton N times (useful for list placeholders). Default: 1.
  count?: number;
}

/**
 * Skeleton — a single shimmering placeholder block.
 *
 * Uses the `.animate-shimmer` keyframe (linear-gradient sweep) which reads
 * more "alive" than a plain pulse. Set `count` to repeat the block N times
 * with a vertical stack — handy for list placeholders.
 *
 * Accessibility: the wrapper has `aria-hidden` and `role="status"` so screen
 * readers announce "loading" without reading the placeholder shapes.
 */
const Skeleton: React.FC<SkeletonProps> = React.memo(({ className = '', variant = 'rect', count = 1 }) => {
  const base =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded'
      : 'rounded-lg';

  if (count <= 1) {
    return (
      <div
        className={`animate-shimmer ${base} ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-shimmer ${base} ${className}`}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
});

export default Skeleton;
