import React from 'react';
import Skeleton from './Skeleton';

/**
 * OrderDetailSkeleton — mirrors the OrderDetail two-column layout (order
 * header bar + 3-column grid: items list, shipping/payment summary, price
 * summary) so loading matches content shape and avoids layout shift.
 */
const OrderDetailSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <div className="container max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* breadcrumb */}
        <Skeleton className="h-4 w-32 mb-6" />

        {/* order header bar */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* left column: order items (spans 2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5">
              <Skeleton className="h-5 w-40 mb-4" />
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-16 w-16 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right column: summaries */}
          <div className="space-y-4">
            {/* shipping address */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5">
              <Skeleton className="h-5 w-32 mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>

            {/* price summary */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5">
              <Skeleton className="h-5 w-28 mb-3" />
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl mt-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailSkeleton;
