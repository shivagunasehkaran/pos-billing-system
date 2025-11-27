/**
 * InventoryService - Manages stock updates and reservations
 */

import { getDataStore } from '../../data/OfflineDataStore';
import { STORES, INDEXES } from '../../data/dbConfig';
import type { InventoryItem, InventoryDelta, Order } from '../types';
import { eventBus } from '../../utils/eventBus';
import { logger } from '../../utils/logger';

export class InventoryService {
  private dataStore = getDataStore();

  /**
   * Get inventory for a product
   */
  async getInventory(productId: string): Promise<InventoryItem | undefined> {
    const items = await this.dataStore.query<InventoryItem>(
      STORES.INVENTORY,
      INDEXES.INVENTORY_BY_PRODUCT_ID,
      IDBKeyRange.only(productId)
    );
    return items[0];
  }

  /**
   * Get all inventory items
   */
  async getAllInventory(): Promise<InventoryItem[]> {
    return this.dataStore.getAll<InventoryItem>(STORES.INVENTORY);
  }

  /**
   * Apply a delta to inventory (add or subtract)
   */
  async applyDelta(delta: InventoryDelta): Promise<void> {
    const existing = await this.getInventory(delta.productId);

    const updated: InventoryItem = existing
      ? {
          ...existing,
          quantity: existing.quantity + delta.delta,
          lastUpdated: Date.now(),
          version: (existing.version || 1) + 1,
        }
      : {
          id: `inv-${delta.productId}`,
          productId: delta.productId,
          quantity: delta.delta,
          reserved: 0,
          lastUpdated: Date.now(),
          version: 1,
        };

    // Ensure quantity doesn't go negative
    if (updated.quantity < 0) {
      logger.warn(`Inventory for ${delta.productId} would go negative, clamping to 0`);
      updated.quantity = 0;
    }

    await this.dataStore.put(STORES.INVENTORY, updated);
    eventBus.emit('inventory:updated', { productId: delta.productId, inventory: updated });
  }

  /**
   * Reserve inventory for an order
   */
  async reserveForOrder(order: Order): Promise<void> {
    for (const item of order.items) {
      const inventory = await this.getInventory(item.productId);
      if (inventory) {
        const updated: InventoryItem = {
          ...inventory,
          reserved: inventory.reserved + item.quantity,
          lastUpdated: Date.now(),
        };
        await this.dataStore.put(STORES.INVENTORY, updated);
      }
    }
  }

  /**
   * Release reservation when order is cancelled
   */
  async releaseReservation(order: Order): Promise<void> {
    for (const item of order.items) {
      const inventory = await this.getInventory(item.productId);
      if (inventory && inventory.reserved >= item.quantity) {
        const updated: InventoryItem = {
          ...inventory,
          reserved: inventory.reserved - item.quantity,
          lastUpdated: Date.now(),
        };
        await this.dataStore.put(STORES.INVENTORY, updated);
      }
    }
  }

  /**
   * Consume inventory when order is completed
   */
  async consumeForOrder(order: Order): Promise<void> {
    for (const item of order.items) {
      await this.applyDelta({
        productId: item.productId,
        delta: -item.quantity,
        reason: 'order_completed',
        orderId: order.id,
      });

      // Release reservation
      const inventory = await this.getInventory(item.productId);
      if (inventory && inventory.reserved >= item.quantity) {
        const updated: InventoryItem = {
          ...inventory,
          reserved: inventory.reserved - item.quantity,
          lastUpdated: Date.now(),
        };
        await this.dataStore.put(STORES.INVENTORY, updated);
      }
    }
  }

  /**
   * Sync inventory snapshot from server
   */
  async syncInventory(items: InventoryItem[]): Promise<void> {
    await this.dataStore.runTransaction([STORES.INVENTORY], async (tx) => {
      const store = tx.objectStore(STORES.INVENTORY);
      
      // Clear existing
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Add synced items
      await Promise.all(
        items.map(
          (item) =>
            new Promise<void>((resolve, reject) => {
              const request = store.put(item);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            })
        )
      );
    });

    logger.info(`Synced ${items.length} inventory items from server`);
    eventBus.emit('inventory:synced', { count: items.length });
  }
}

// Singleton instance
let inventoryServiceInstance: InventoryService | null = null;

export const getInventoryService = (): InventoryService => {
  if (!inventoryServiceInstance) {
    inventoryServiceInstance = new InventoryService();
  }
  return inventoryServiceInstance;
};

