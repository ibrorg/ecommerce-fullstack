import React, { useState, useRef, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

/**
 * CurrencySwitcher — compact dropdown that swaps the active display currency.
 *
 * Renders the current currency code + symbol. On open, lists every supported
 * currency with its label and symbol. Choice persists via CurrencyContext
 * (localStorage). Keyboard accessible: Escape closes, click-outside closes.
 */
const CurrencySwitcher: React.FC = () => {
  const { currency, setCurrency, currencies } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Currency: ${currency.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <span className="text-sm font-semibold">{currency.symbol}</span>
        <span className="text-xs font-semibold uppercase">{currency.code}</span>
        <FiChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1 z-50 animate-fade-in"
        >
          {currencies.map((c) => {
            const active = c.code === currency.code;
            return (
              <li key={c.code}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setCurrency(c.code);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-6 text-center font-semibold">{c.symbol}</span>
                    <span className="flex flex-col items-start">
                      <span>{c.code}</span>
                      <span className="text-xs text-neutral-400">{c.label}</span>
                    </span>
                  </span>
                  {active && <FiCheck size={16} className="text-neutral-900 dark:text-neutral-100" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CurrencySwitcher;
