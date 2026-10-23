import React from 'react';
import Skeleton from './Skeleton';

/**
 * OrderHistorySkeleton — mirrors the order card list layout so the loading
 * state matches the real content shape and avoids layout shift on load.
 */
const OrderHistorySkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <div className="container max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* header */}
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-8" />

        {/* order cards */}
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden p-6"
            >
              {/* top row: order number + status */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>

              {/* items row */}
              <div className="space-y-3 mb-4">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>

              {/* footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-neutral-800">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrderHistorySkeleton;
