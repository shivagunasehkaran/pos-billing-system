/**
 * IndexedDB schema configuration
 */

export const DB_NAME = 'pos-db';
export const DB_VERSION = 1;

export const STORES = {
  ORDERS: 'orders',
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  PRINT_JOBS: 'printJobs',
  OUTBOX: 'outbox',
  SYNC_STATE: 'syncState',
} as const;

export const INDEXES = {
  // Orders indexes
  ORDERS_BY_STATUS: 'byStatus',
  ORDERS_BY_CREATED: 'byCreated',
  ORDERS_BY_UPDATED: 'byUpdated',
  
  // Products indexes
  PRODUCTS_BY_CATEGORY: 'byCategory',
  PRODUCTS_BY_NAME: 'byName',
  
  // Inventory indexes
  INVENTORY_BY_PRODUCT_ID: 'byProductId',
  
  // Print jobs indexes
  PRINT_JOBS_BY_STATUS: 'byStatus',
  PRINT_JOBS_BY_PRIORITY: 'byPriority',
  
  // Outbox indexes
  OUTBOX_BY_ENTITY_TYPE: 'byEntityType',
  OUTBOX_BY_TIMESTAMP: 'byTimestamp',
} as const;

export interface DBConfig {
  name: string;
  version: number;
  stores: typeof STORES;
  indexes: typeof INDEXES;
}

export const dbConfig: DBConfig = {
  name: DB_NAME,
  version: DB_VERSION,
  stores: STORES,
  indexes: INDEXES,
};

