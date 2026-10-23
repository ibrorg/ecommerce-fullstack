import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiHome } from 'react-icons/fi';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumbs — navigation trail with Schema.org BreadcrumbList JSON-LD
 * structured data for Google rich results. Renders a visible trail + injects
 * the structured data script.
 */
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  // inject BreadcrumbList JSON-LD for SEO
  React.useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'breadcrumb-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        ...(item.href && { item: item.href }),
      })),
    });
    document.head.appendChild(script);
    return () => {
      document.getElementById('breadcrumb-jsonld')?.remove();
    };
  }, [items]);

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-sm ${className}`}>
      <Link
        to="/"
        className="text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
        aria-label="Home"
      >
        <FiHome size={14} />
      </Link>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <FiChevronRight size={12} className="text-gray-300 dark:text-neutral-600 flex-shrink-0" />
          {item.href && index < items.length - 1 ? (
            <Link
              to={item.href}
              className="text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors truncate"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="text-gray-900 dark:text-neutral-100 font-medium truncate"
              aria-current={index === items.length - 1 ? 'page' : undefined}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
