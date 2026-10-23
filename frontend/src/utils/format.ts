// Formatting helpers used across the e-commerce UI.
// Kept dependency-free (uses the Intl API) so they are trivially testable.

/**
 * Format a number as a currency string.
 *
 * @param amount   - Numeric amount to format.
 * @param currency - ISO 4217 currency code (defaults to USD).
 * @returns Localized currency string, e.g. "$12.50".
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Format an ISO date string or Date instance as a human-readable date.
 *
 * @param date - ISO date string or Date instance.
 * @returns Formatted date like "Jan 5, 2025", or "Invalid date" for bad input.
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
};

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/**
 * Map an internal order status code to a user-facing label.
 *
 * @param status - One of the supported order status values.
 * @returns Capitalized label, e.g. "Shipped".
 */
export const formatOrderStatus = (status: OrderStatus): string => {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return labels[status];
};
