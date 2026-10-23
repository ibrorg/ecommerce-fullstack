import React from 'react';
import Skeleton from './Skeleton';

interface DashboardSkeletonProps {
  // number of stat cards in the top row
  statCount?: number;
  // show the two chart placeholders
  showCharts?: boolean;
}

/**
 * DashboardSkeleton — mirrors the admin/seller dashboard layout (title +
 * stat-card row + two chart panels). Used by AdminDashboard + SellerDashboard.
 */
const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  statCount = 4,
  showCharts = true,
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* title */}
        <Skeleton className="h-8 w-56 mb-6" />

        {/* stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: statCount }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-5"
            >
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        {/* charts */}
        {showCharts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-6 h-80">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-full w-full" />
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-6 h-80">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-full w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSkeleton;
