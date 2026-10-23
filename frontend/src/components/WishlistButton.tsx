import React, { useState } from 'react';
import { FiHeart, FiTrash2, FiLoader, FiCheck } from 'react-icons/fi';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addToWishlist, removeFromWishlist } from '../store/slices/wishlistSlice';
import toast from 'react-hot-toast';

export interface WishlistButtonProps {
  productId: string;
  /** Optional callback fired after the wishlist state for this product changes. */
  onWishlistChange?: (inWishlist: boolean) => void;
  /** Visual variant: bare icon (overlay on cards) or labelled button (detail page). */
  variant?: 'icon' | 'button';
  /** Extra classes for the button root. */
  className?: string;
  /** Accessible label override (icon variant only). */
  ariaLabel?: string;
}

/**
 * Heart toggle that adds / removes a product from the authenticated user's
 * wishlist. Reads shared wishlist state from Redux so every instance reflects
 * the server truth. The icon variant always renders a heart (filled when
 * saved); the button variant renders a labelled "Add / Remove" affordance.
 */
const WishlistButton: React.FC<WishlistButtonProps> = ({
  productId,
  onWishlistChange,
  variant = 'icon',
  className = '',
  ariaLabel,
}) => {
  const dispatch = useAppDispatch();
  const inWishlist = useAppSelector((state) =>
    state.wishlist.items.some((i) => i.product._id === productId)
  );
  const [pending, setPending] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    try {
      if (inWishlist) {
        await dispatch(removeFromWishlist(productId)).unwrap();
        onWishlistChange?.(false);
        toast.success('Removed from wishlist');
      } else {
        await dispatch(addToWishlist(productId)).unwrap();
        onWishlistChange?.(true);
        toast(
          (t) => (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <FiHeart className="text-white fill-current" size={16} />
              </div>
              <p className="font-semibold text-white text-sm">Added to wishlist</p>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  dispatch(removeFromWishlist(productId));
                }}
                className="text-xs font-semibold text-neutral-300 hover:text-white ml-2"
              >
                Undo
              </button>
            </div>
          ),
          { duration: 3000 }
        );
      }
    } catch {
      toast.error('Could not update wishlist');
    } finally {
      setPending(false);
    }
  };

  const label = ariaLabel ?? (inWishlist ? 'Remove from wishlist' : 'Add to wishlist');

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={label}
        aria-pressed={inWishlist}
        className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg border transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
          inWishlist
            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300'
            : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50'
        } ${className}`}
      >
        {pending ? (
          <FiLoader className="w-4 h-4 animate-spin" />
        ) : inWishlist ? (
          <FiTrash2 className="w-4 h-4" />
        ) : (
          <FiHeart className="w-4 h-4" />
        )}
        <span>{inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}</span>
      </button>
    );
  }

  // Icon variant — small overlay button used on product cards.
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={label}
      aria-pressed={inWishlist}
      className={`flex items-center justify-center h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {pending ? (
        <FiLoader className="w-4 h-4 animate-spin text-gray-500" />
      ) : inWishlist ? (
        <FiHeart className="w-4 h-4 fill-current text-red-500" />
      ) : (
        <FiHeart className="w-4 h-4 text-gray-500 hover:text-red-500" />
      )}
    </button>
  );
};

export default WishlistButton;
