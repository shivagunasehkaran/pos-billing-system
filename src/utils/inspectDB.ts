/**
 * IndexedDB Inspection Utilities
 * Use these functions in browser console to inspect database contents
 */

import { getDataStore } from '../data/OfflineDataStore';
import { STORES } from '../data/dbConfig';

type StoreName = typeof STORES[keyof typeof STORES];

/**
 * Inspect all data in IndexedDB
 * Usage: In browser console, import and call:
 *   import { inspectAllData } from './utils/inspectDB';
 *   inspectAllData();
 */
export async function inspectAllData() {
  const dataStore = getDataStore();
  await dataStore.init();

  console.log('📦 IndexedDB Inspection Report');
  console.log('═'.repeat(50));

  // Inspect each store
  const stores = Object.values(STORES);
  
  for (const storeName of stores) {
    try {
      const data = await dataStore.getAll(storeName);
      console.log(`\n📁 ${storeName}:`);
      console.log(`   Count: ${data.length} records`);
      
      if (data.length > 0) {
        console.log(`   Sample (first record):`, data[0]);
        if (data.length > 1) {
          console.log(`   ... and ${data.length - 1} more`);
        }
      }
    } catch (error) {
      console.error(`   Error reading ${storeName}:`, error);
    }
  }

  // Check outbox
  const outbox = await dataStore.getOutboxOperations();
  console.log(`\n📬 Outbox: ${outbox.length} pending operations`);
  if (outbox.length > 0) {
    console.table(outbox);
  }

  // Check sync state
  const syncState = await dataStore.getSyncState('syncState');
  console.log(`\n🔄 Sync State:`, syncState);
}

/**
 * Inspect a specific store
 */
export async function inspectStore(storeName: StoreName) {
  const dataStore = getDataStore();
  await dataStore.init();

  try {
    const data = await dataStore.getAll(storeName);
    console.log(`📁 ${storeName}:`);
    console.log(`   Total records: ${data.length}`);
    console.table(data);
    return data;
  } catch (error) {
    console.error(`Error reading ${storeName}:`, error);
    return null;
  }
}

/**
 * Inspect orders
 */
export async function inspectOrders() {
  return inspectStore(STORES.ORDERS);
}

/**
 * Inspect products
 */
export async function inspectProducts() {
  return inspectStore(STORES.PRODUCTS);
}

/**
 * Inspect inventory
 */
export async function inspectInventory() {
  return inspectStore(STORES.INVENTORY);
}

/**
 * Inspect print jobs
 */
export async function inspectPrintJobs() {
  return inspectStore(STORES.PRINT_JOBS);
}

/**
 * Inspect outbox operations
 */
export async function inspectOutbox() {
  const dataStore = getDataStore();
  await dataStore.init();
  
  const operations = await dataStore.getOutboxOperations();
  console.log(`📬 Outbox: ${operations.length} pending operations`);
  console.table(operations);
  return operations;
}

/**
 * Get database statistics
 */
export async function getDBStats() {
  const dataStore = getDataStore();
  await dataStore.init();

  const stats: Record<string, number> = {};

  for (const storeName of Object.values(STORES)) {
    try {
      const data = await dataStore.getAll(storeName);
      stats[storeName] = data.length;
    } catch (error) {
      stats[storeName] = -1; // Error
    }
  }

  const outbox = await dataStore.getOutboxOperations();
  stats['outbox'] = outbox.length;

  console.log('📊 Database Statistics:');
  console.table(stats);
  return stats;
}

/**
 * Clear all data (use with caution!)
 */
export async function clearAllData() {
  if (!confirm('⚠️ Are you sure you want to delete ALL data? This cannot be undone!')) {
    return;
  }

  const dataStore = getDataStore();
  await dataStore.init();

  for (const storeName of Object.values(STORES)) {
    try {
      const all = await dataStore.getAll(storeName);
      for (const item of all) {
        await dataStore.delete(storeName, (item as any).id);
      }
      console.log(`✅ Cleared ${storeName}`);
    } catch (error) {
      console.error(`❌ Error clearing ${storeName}:`, error);
    }
  }

  console.log('✅ All data cleared!');
}

// Make functions available globally in development
if (import.meta.env.DEV) {
  (window as any).inspectDB = {
    all: inspectAllData,
    store: inspectStore,
    orders: inspectOrders,
    products: inspectProducts,
    inventory: inspectInventory,
    printJobs: inspectPrintJobs,
    outbox: inspectOutbox,
    stats: getDBStats,
    clear: clearAllData,
  };
}

