import React, { useState } from 'react';
import { FiBell, FiCheck, FiBellOff } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface BackInStockButtonProps {
  productId: string;
  productName: string;
  className?: string;
}

/**
 * BackInStockButton — lets users subscribe to back-in-stock notifications
 * for out-of-stock products. Stores subscriptions in localStorage (no backend
 * needed — a real implementation would POST to a /api/notifications/stock
 * endpoint, but this works as a UX feature for the demo).
 */
const BackInStockButton: React.FC<BackInStockButtonProps> = ({
  productId,
  productName,
  className = '',
}) => {
  const [subscribed, setSubscribed] = useState(() => {
    try {
      const subs = JSON.parse(localStorage.getItem('stockAlerts') || '[]');
      return subs.includes(productId);
    } catch {
      return false;
    }
  });

  const handleClick = () => {
    try {
      const subs = JSON.parse(localStorage.getItem('stockAlerts') || '[]');
      if (subscribed) {
        const next = subs.filter((id: string) => id !== productId);
        localStorage.setItem('stockAlerts', JSON.stringify(next));
        setSubscribed(false);
        toast.success('Removed stock alert');
      } else {
        const next = [...subs, productId];
        localStorage.setItem('stockAlerts', JSON.stringify(next));
        setSubscribed(true);
        toast.success(`We'll notify you when "${productName}" is back in stock`);
      }
    } catch {
      toast.error('Could not update stock alert');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95 ${
        subscribed
          ? 'border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 text-green-700 dark:text-green-400'
          : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-200 hover:border-gray-300 dark:hover:border-neutral-600'
      } ${className}`}
    >
      {subscribed ? (
        <>
          <FiCheck size={16} />
          Alert set
        </>
      ) : (
        <>
          <FiBell size={16} />
          Notify me when available
        </>
      )}
    </button>
  );
};

export default BackInStockButton;
