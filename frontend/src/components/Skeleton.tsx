import React from 'react';

interface SkeletonProps {
  className?: string;
  // "rect" (default), "circle", or "text" — just sizing hints
  variant?: 'rect' | 'circle' | 'text';
}

/**
 * Skeleton — a single shimmering placeholder block.
 * Uses the existing .skeleton keyframe from index.css plus a pulse overlay.
 */
const Skeleton: React.FC<SkeletonProps> = React.memo(({ className = '', variant = 'rect' }) => {
  const base =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded'
      : 'rounded-lg';
  return (
    <div
      className={`skeleton ${base} ${className}`}
      aria-hidden="true"
    />
  );
});

export default Skeleton;
