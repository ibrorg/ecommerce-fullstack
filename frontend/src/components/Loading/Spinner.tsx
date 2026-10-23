import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullScreen?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  message, 
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16 sm:w-20 sm:h-20',
    xl: 'w-20 h-20 sm:w-24 sm:h-24',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4 px-4">
      <div className="relative">
        {/* Outer ring */}
        <div className={`${sizeClasses[size]} rounded-full border-2 border-gray-200 dark:border-neutral-700 opacity-50`} />
        
        {/* Spinning ring */}
        <div
          className={`${sizeClasses[size]} rounded-full border-2 border-transparent border-t-black border-r-black dark:border-t-white dark:border-r-white absolute top-0 left-0 animate-spin`}
          style={{
            animationDuration: '1s',
          }}
        />

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-black dark:bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>

      {message && (
        <div className="text-center">
          <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-neutral-100">{message}</p>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-neutral-400 mt-1">Please wait...</p>
        </div>
      )}

      {/* Developer Credit */}
      <div className="mt-6 text-center animate-pulse">
        <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-neutral-500 tracking-wide">
          Made with <span className="text-red-500 animate-bounce inline-block">❤</span> by{' '}
          <span className="font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent">
            IBR
          </span>
        </p>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default Spinner;
