import React from 'react';
import Skeleton from './Skeleton';

/**
 * ProductDetailSkeleton — mirrors the two-column ProductDetail layout so the
 * loading state matches the real content shape (avays layout shift on load).
 */
const ProductDetailSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <div className="container px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* breadcrumb */}
        <Skeleton className="h-4 w-40 mb-8" />

        <div className="grid grid-cols-1 gap-8 sm:gap-10 lg:gap-16 lg:grid-cols-2">
          {/* image column */}
          <div className="space-y-4 sm:space-y-6">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-24 rounded-xl flex-shrink-0" />
              ))}
            </div>
          </div>

          {/* info column */}
          <div className="space-y-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-2/3" />

            <div className="flex items-center gap-3 pt-4">
              <Skeleton variant="circle" className="h-8 w-8" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>

            <Skeleton className="h-16 w-full rounded-2xl" />

            <div className="flex gap-3 pt-4">
              <Skeleton className="h-12 w-28 rounded-xl" />
              <Skeleton className="h-12 flex-1 rounded-xl" />
            </div>

            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />

            <div className="grid grid-cols-2 gap-4 pt-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailSkeleton;
