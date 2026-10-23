import React from 'react';
import Spinner from './Spinner';

const LoadingFallback: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center px-4">
      <Spinner />
    </div>
  );
};

export default LoadingFallback;
