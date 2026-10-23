import React from 'react';

// Merchandising badges rendered on product cards + detail surfaces.
// The badge values come from the backend's computeBadges() helper.
type Badge = 'New' | 'Sale' | 'Top Rated' | 'Bestseller' | 'Low Stock';

interface ProductBadgesProps {
  badges?: string[];
  // layout: "overlay" stacks on the image, "inline" sits in a row
  variant?: 'overlay' | 'inline';
  className?: string;
}

const badgeStyles: Record<Badge, { bg: string; text: string; label: string }> = {
  'New': { bg: 'bg-blue-500', text: 'text-white', label: 'New' },
  'Sale': { bg: 'bg-red-500', text: 'text-white', label: 'Sale' },
  'Top Rated': { bg: 'bg-amber-500', text: 'text-white', label: '★ Top Rated' },
  'Bestseller': { bg: 'bg-neutral-900', text: 'text-white', label: 'Bestseller' },
  'Low Stock': { bg: 'bg-orange-500', text: 'text-white', label: 'Low Stock' },
};

const ProductBadges: React.FC<ProductBadgesProps> = React.memo(({
  badges = [],
  variant = 'inline',
  className = '',
}) => {
  if (!badges || badges.length === 0) return null;

  const validBadges = badges.filter((b) => b in badgeStyles) as Badge[];
  if (validBadges.length === 0) return null;

  if (variant === 'overlay') {
    return (
      <div className={`absolute top-2 left-2 z-10 flex flex-col gap-1 ${className}`}>
        {validBadges.slice(0, 3).map((badge) => {
          const s = badgeStyles[badge];
          return (
            <span
              key={badge}
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${s.bg} ${s.text} shadow-sm`}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {validBadges.map((badge) => {
        const s = badgeStyles[badge];
        return (
          <span
            key={badge}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${s.bg} ${s.text}`}
          >
            {s.label}
          </span>
        );
      })}
    </div>
  );
});

export default ProductBadges;
