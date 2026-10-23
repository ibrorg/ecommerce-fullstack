import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleCompare } from '../store/slices/compareSlice';
import { FiColumns } from 'react-icons/fi';

interface CompareButtonProps {
  productId: string;
  name: string;
  price: number;
  image: string;
  variant?: 'icon' | 'pill';
}

const CompareButton: React.FC<CompareButtonProps> = ({
  productId,
  name,
  price,
  image,
  variant = 'icon',
}) => {
  const dispatch = useAppDispatch();
  const inCompare = useAppSelector((state) =>
    state.compare.items.some((i) => i.id === productId)
  );

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(toggleCompare({ id: productId, name, price, image }));
  };

  if (variant === 'pill') {
    return (
      <button
        onClick={handleToggle}
        aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
          inCompare
            ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
            : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-200 border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
        }`}
      >
        <FiColumns size={14} className={inCompare ? 'fill-current' : ''} />
        {inCompare ? 'In Compare' : 'Compare'}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
      title={inCompare ? 'Remove from compare' : 'Add to compare'}
      className={`p-2 rounded-full backdrop-blur transition-all ${
        inCompare
          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
          : 'bg-white/80 dark:bg-neutral-900/80 text-gray-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800'
      }`}
    >
      <FiColumns size={15} className={inCompare ? 'fill-current' : ''} />
    </button>
  );
};

export default CompareButton;
