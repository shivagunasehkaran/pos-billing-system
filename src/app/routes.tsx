/**
 * Simple routing configuration
 */

export type Route = 'order-entry' | 'kitchen' | 'print-settings';

export const routes: Record<Route, { path: string; title: string }> = {
  'order-entry': { path: '/', title: 'Order Entry' },
  kitchen: { path: '/kitchen', title: 'Kitchen Display' },
  'print-settings': { path: '/print', title: 'Print Settings' },
};

