import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

/**
 * CurrencyContext — multi-currency support for the storefront.
 *
 * The selected currency is persisted to localStorage and applied to every
 * price via `formatPrice`. Exchange rates are static fallbacks (sane defaults
 * relative to USD); a real deployment should replace `RATES` with a live
 * feed (e.g. openexchangerates / ECB / fixer) behind a backend endpoint.
 *
 * Design notes:
 *  - Prices are stored in USD across the catalog/backend (single source of
 *    truth). Conversion happens only at display time so cart math stays exact.
 *  - JPY (and other zero-decimal currencies) are handled: no fraction digits.
 *  - The formatter uses `Intl.NumberFormat` for locale-correct grouping.
 */

export interface Currency {
  code: string;
  symbol: string;
  label: string;
  /** Decimal places for this currency (JPY = 0, most = 2). */
  decimals: number;
  /** Exchange rate relative to USD (1 USD = rate units of this currency). */
  rate: number;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$',   label: 'US Dollar',        decimals: 2, rate: 1 },
  { code: 'EUR', symbol: '€',   label: 'Euro',              decimals: 2, rate: 0.92 },
  { code: 'GBP', symbol: '£',   label: 'British Pound',     decimals: 2, rate: 0.79 },
  { code: 'INR', symbol: '₹',   label: 'Indian Rupee',      decimals: 2, rate: 83.2 },
  { code: 'JPY', symbol: '¥',   label: 'Japanese Yen',      decimals: 0, rate: 156.4 },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham',        decimals: 2, rate: 3.67 },
  { code: 'AUD', symbol: 'A$',  label: 'Australian Dollar', decimals: 2, rate: 1.51 },
  { code: 'CAD', symbol: 'C$',  label: 'Canadian Dollar',   decimals: 2, rate: 1.37 },
];

const STORAGE_KEY = 'currency';
const DEFAULT_CODE = 'USD';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (code: string) => void;
  /** Format a USD amount into the active currency. */
  formatPrice: (usdAmount: number) => string;
  /** List of all supported currencies (for the switcher). */
  currencies: Currency[];
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const findByCode = (code: string): Currency =>
  CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === 'undefined') return findByCode(DEFAULT_CODE);
    return findByCode(localStorage.getItem(STORAGE_KEY) || DEFAULT_CODE);
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currency.code);
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [currency.code]);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(findByCode(code));
  }, []);

  const formatPrice = useCallback(
    (usdAmount: number) => {
      const converted = usdAmount * currency.rate;
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: currency.code,
          minimumFractionDigits: currency.decimals,
          maximumFractionDigits: currency.decimals,
        }).format(converted);
      } catch {
        // Fallback if Intl lacks the currency data (very old environments).
        return `${currency.symbol}${converted.toFixed(currency.decimals)}`;
      }
    },
    [currency],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, currencies: CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
