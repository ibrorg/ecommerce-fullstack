import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 transition-colors">
      <div className="container section">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-neutral-950 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 text-sm font-bold">
                E
              </div>
              <span className="font-semibold text-neutral-950 dark:text-neutral-100">E-Shop</span>
            </Link>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">
              Quality products, thoughtfully selected. Simple shopping, exceptional service.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-meta text-neutral-500 dark:text-neutral-400 mb-4">SHOP</h4>
            <ul className="space-y-3">
              {[
                { label: 'All Products', href: '/products' },
                { label: 'New Arrivals', href: '/products' },
                { label: 'Best Sellers', href: '/products' },
              ].map((item) => (
                <li key={item.label}>
                  <Link 
                    to={item.href} 
                    className="text-sm text-neutral-600 hover:text-neutral-950 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-meta text-neutral-500 dark:text-neutral-400 mb-4">ACCOUNT</h4>
            <ul className="space-y-3">
              {[
                { label: 'Profile', href: '/profile' },
                { label: 'Orders', href: '/orders' },
                { label: 'Cart', href: '/cart' },
              ].map((item) => (
                <li key={item.label}>
                  <Link 
                    to={item.href} 
                    className="text-sm text-neutral-600 hover:text-neutral-950 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-meta text-neutral-500 dark:text-neutral-400 mb-4">CONTACT</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a 
                  href="https://github.com/ibrorg" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 hover:text-neutral-950 transition-colors"
                >
                  github.com/ibrorg
                </a>
              </li>
              <li className="text-neutral-500">
                Mon–Fri, 9am–6pm ET
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} E-Shop. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-sm text-neutral-500">
              Made with <span className="text-red-500">❤</span> by{' '}
              <a 
                href="https://github.com/ibrorg" 
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold bg-gradient-to-r from-neutral-900 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
              >
                ibrorg
              </a>
            </span>
            <a href="#" className="text-sm text-neutral-500 hover:text-neutral-950 transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-neutral-500 hover:text-neutral-950 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
