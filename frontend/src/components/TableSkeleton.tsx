import React from 'react';
import Skeleton from './Skeleton';

interface TableSkeletonProps {
  // number of rows to show
  rowCount?: number;
  // title width
  titleWidth?: string;
}

/**
 * TableSkeleton — mirrors the admin/seller table layout (title + bordered
 * card with row placeholders that have a few cell-shaped bars). Used by
 * AdminProducts, AdminOrders, AdminUsers, SellerProducts, SellerOrders.
 */
const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rowCount = 6,
  titleWidth = 'w-56',
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* title */}
        <Skeleton className={`h-8 ${titleWidth} mb-6`} />

        {/* table card */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
          {/* header row */}
          <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          {/* body rows */}
          {Array.from({ length: rowCount }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 dark:border-neutral-800 last:border-b-0"
            >
              <Skeleton variant="circle" className="h-8 w-8 flex-shrink-0" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20 hidden sm:block" />
              <Skeleton className="h-4 w-16 hidden sm:block" />
              <Skeleton className="h-6 w-16 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TableSkeleton;
