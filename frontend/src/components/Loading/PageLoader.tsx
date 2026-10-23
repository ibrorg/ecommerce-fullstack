import React from 'react';
import Spinner from './Spinner';

interface PageLoaderProps {
  isLoading: boolean;
  message?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ isLoading, message = 'Loading...' }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-sm flex items-center justify-center z-[9999] px-4">
      <Spinner size="lg" message={message} />
    </div>
  );
};

export default PageLoader;
