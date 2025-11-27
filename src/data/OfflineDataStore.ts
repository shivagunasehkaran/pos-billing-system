/**
 * OfflineDataStore - A reusable abstraction over IndexedDB
 * Features:
 * - Read-through cache (memory first, then IndexedDB)
 * - Write queue / outbox for offline operations
 * - Transaction support with rollback
 * - Event emission for UI updates
 */

import { DB_NAME, DB_VERSION, STORES, INDEXES } from './dbConfig';
import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';

type StoreName = typeof STORES[keyof typeof STORES];
type IndexName = typeof INDEXES[keyof typeof INDEXES];

interface OutboxOperation {
  id: string;
  entityType: StoreName;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
  deviceId: string;
  operationId: string; // For idempotency
}


export class OfflineDataStore {
  private db: IDBDatabase | null = null;
  private memoryCache: Map<StoreName, Map<string, any>> = new Map();
  private cacheMaxSize: Map<StoreName, number> = new Map();
  private deviceId: string;
  private initPromise: Promise<void> | null = null;

  constructor(deviceId?: string) {
    this.deviceId = deviceId || this.generateDeviceId();
    this.initializeCache();
  }

  private generateDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private initializeCache(): void {
    // Initialize cache maps for each store
    Object.values(STORES).forEach((store) => {
      this.memoryCache.set(store, new Map());
      // Set cache limits (keep only recent N items in memory)
      this.cacheMaxSize.set(store, 100);
    });
  }

  /**
   * Initialize IndexedDB database
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.ORDERS)) {
          const ordersStore = db.createObjectStore(STORES.ORDERS, { keyPath: 'id' });
          ordersStore.createIndex(INDEXES.ORDERS_BY_STATUS, 'status');
          ordersStore.createIndex(INDEXES.ORDERS_BY_CREATED, 'createdAt');
          ordersStore.createIndex(INDEXES.ORDERS_BY_UPDATED, 'updatedAt');
        }

        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productsStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          productsStore.createIndex(INDEXES.PRODUCTS_BY_CATEGORY, 'category');
          productsStore.createIndex(INDEXES.PRODUCTS_BY_NAME, 'name');
        }

        if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
          const inventoryStore = db.createObjectStore(STORES.INVENTORY, { keyPath: 'id' });
          inventoryStore.createIndex(INDEXES.INVENTORY_BY_PRODUCT_ID, 'productId');
        }

        if (!db.objectStoreNames.contains(STORES.PRINT_JOBS)) {
          const printJobsStore = db.createObjectStore(STORES.PRINT_JOBS, { keyPath: 'id' });
          printJobsStore.createIndex(INDEXES.PRINT_JOBS_BY_STATUS, 'status');
          printJobsStore.createIndex(INDEXES.PRINT_JOBS_BY_PRIORITY, ['priority', 'createdAt']);
        }

        if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
          const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'id' });
          outboxStore.createIndex(INDEXES.OUTBOX_BY_ENTITY_TYPE, 'entityType');
          outboxStore.createIndex(INDEXES.OUTBOX_BY_TIMESTAMP, 'timestamp');
        }

        if (!db.objectStoreNames.contains(STORES.SYNC_STATE)) {
          db.createObjectStore(STORES.SYNC_STATE, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get a single item by key (read-through cache)
   */
  async get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    await this.init();

    // Check memory cache first
    const cache = this.memoryCache.get(store);
    if (cache?.has(String(key))) {
      return cache.get(String(key)) as T;
    }

    // Fall back to IndexedDB
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([store], 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.get(key);

      request.onsuccess = () => {
        const result = request.result as T | undefined;
        if (result && cache) {
          this.updateCache(store, String(key), result);
        }
        resolve(result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all items from a store
   */
  async getAll<T>(store: StoreName): Promise<T[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([store], 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const results = request.result as T[];
        // Update cache
        const cache = this.memoryCache.get(store);
        if (cache) {
          results.forEach((item: any) => {
            if (item?.id) {
              this.updateCache(store, String(item.id), item);
            }
          });
        }
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Query items by index
   */
  async query<T>(
    store: StoreName,
    indexName: IndexName,
    range?: IDBKeyRange
  ): Promise<T[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([store], 'readonly');
      const objectStore = transaction.objectStore(store);
      const index = objectStore.index(indexName);
      const request = range ? index.getAll(range) : index.getAll();

      request.onsuccess = () => {
        const results = request.result as T[];
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Put (create or update) an item
   */
  async put<T extends { id: string }>(store: StoreName, item: T): Promise<void> {
    await this.init();

    // Update memory cache
    const cache = this.memoryCache.get(store);
    if (cache) {
      this.updateCache(store, item.id, item);
    }

    // Write to IndexedDB
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([store], 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.put(item);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    // Queue operation in outbox
    await this.queueOperation({
      entityType: store,
      entityId: item.id,
      operation: 'UPDATE',
      payload: item,
    });

    // Emit event
    eventBus.emit(`${store}:updated`, item);
  }

  /**
   * Create a new item (assigns temporary ID if needed)
   */
  async create<T extends { id?: string }>(store: StoreName, item: T): Promise<string> {
    await this.init();

    // Generate temporary ID if not provided
    const id = item.id || this.generateTempId();
    const itemWithId = { ...item, id };

    // Update memory cache
    const cache = this.memoryCache.get(store);
    if (cache) {
      this.updateCache(store, id, itemWithId);
    }

    // Write to IndexedDB
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([store], 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.put(itemWithId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    // Queue operation in outbox
    await this.queueOperation({
      entityType: store,
      entityId: id,
      operation: 'CREATE',
      payload: itemWithId,
    });

    // Emit event
    eventBus.emit(`${store}:created`, itemWithId);

    return id;
  }

  /**
   * Delete an item
   */
  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    await this.init();

    // Remove from memory cache
    const cache = this.memoryCache.get(store);
    cache?.delete(String(key));

    // Delete from IndexedDB
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([store], 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    // Queue operation in outbox
    await this.queueOperation({
      entityType: store,
      entityId: String(key),
      operation: 'DELETE',
      payload: null,
    });

    // Emit event
    eventBus.emit(`${store}:deleted`, key);
  }

  /**
   * Run a transaction with multiple operations
   */
  async runTransaction(
    stores: StoreName[],
    operations: (tx: IDBTransaction) => Promise<void>
  ): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(stores, 'readwrite');
      
      transaction.onerror = () => {
        reject(transaction.error);
      };

      transaction.oncomplete = () => {
        resolve();
      };

      operations(transaction).then(resolve).catch(reject);
    });
  }

  /**
   * Queue an operation in the outbox
   */
  private async queueOperation(op: Omit<OutboxOperation, 'id' | 'timestamp' | 'deviceId' | 'operationId'>): Promise<void> {
    await this.init();

    const operation: OutboxOperation = {
      id: `${op.entityType}-${op.entityId}-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      deviceId: this.deviceId,
      operationId: `${this.deviceId}-${Date.now()}-${Math.random()}`,
      ...op,
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORES.OUTBOX], 'readwrite');
      const objectStore = transaction.objectStore(STORES.OUTBOX);
      const request = objectStore.put(operation);

      request.onsuccess = () => {
        eventBus.emit('outbox:operation-queued', operation);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending operations from outbox
   */
  async getOutboxOperations(entityType?: StoreName): Promise<OutboxOperation[]> {
    await this.init();

    if (entityType) {
      return this.query<OutboxOperation>(
        STORES.OUTBOX,
        INDEXES.OUTBOX_BY_ENTITY_TYPE,
        IDBKeyRange.only(entityType)
      );
    }

    return this.getAll<OutboxOperation>(STORES.OUTBOX);
  }

  /**
   * Remove operations from outbox (after successful sync)
   */
  async clearOutboxOperations(operationIds: string[]): Promise<void> {
    await this.init();

    await this.runTransaction([STORES.OUTBOX], async (tx) => {
      const store = tx.objectStore(STORES.OUTBOX);
      await Promise.all(
        operationIds.map(
          (id) =>
            new Promise<void>((resolve, reject) => {
              const request = store.delete(id);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            })
        )
      );
    });
  }

  /**
   * Update sync state
   */
  async setSyncState(key: string, value: any): Promise<void> {
    await this.init();

    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORES.SYNC_STATE], 'readwrite');
      const objectStore = transaction.objectStore(STORES.SYNC_STATE);
      const request = objectStore.put({ key, value, updatedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get sync state
   */
  async getSyncState<T>(key: string): Promise<T | undefined> {
    await this.init();

    const result = await this.get<{ key: string; value: T }>(STORES.SYNC_STATE, key);
    return result?.value ?? undefined;
  }

  /**
   * Update memory cache with size limits
   */
  private updateCache(store: StoreName, key: string, value: any): void {
    const cache = this.memoryCache.get(store);
    if (!cache) return;

    const maxSize = this.cacheMaxSize.get(store) || 100;
    
    // If cache is full, remove oldest entry (simple FIFO)
    if (cache.size >= maxSize && !cache.has(key)) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, value);
  }

  /**
   * Generate temporary ID for offline creates
   */
  private generateTempId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear cache for a store
   */
  clearCache(store?: StoreName): void {
    if (store) {
      this.memoryCache.get(store)?.clear();
    } else {
      this.memoryCache.forEach((cache) => cache.clear());
    }
  }

  getDeviceId(): string {
    return this.deviceId;
  }
}

// Singleton instance
let dataStoreInstance: OfflineDataStore | null = null;

export const getDataStore = (): OfflineDataStore => {
  if (!dataStoreInstance) {
    dataStoreInstance = new OfflineDataStore();
  }
  return dataStoreInstance;
};

