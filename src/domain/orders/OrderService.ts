/**
 * OrderService - Manages order creation, updates, and status transitions
 */

import { getDataStore } from '../../data/OfflineDataStore';
import { STORES, INDEXES } from '../../data/dbConfig';
import type { Order, OrderStatus, OrderItem } from '../types';
import { eventBus } from '../../utils/eventBus';
import { logger } from '../../utils/logger';

const STATUS_ORDER: Record<OrderStatus, number> = {
  pending: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
  cancelled: 0,
};

export class OrderService {
  private dataStore = getDataStore();

  /**
   * Create a new order from cart items
   */
  async createOrder(
    items: OrderItem[],
    customerMeta?: { name?: string; phone?: string; notes?: string }
  ): Promise<string> {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.1; // 10% tax (configurable)
    const total = subtotal + tax;

    const order: Order = {
      id: '', // Will be assigned by create
      status: 'pending',
      items,
      subtotal,
      tax,
      total,
      customerName: customerMeta?.name,
      customerPhone: customerMeta?.phone,
      notes: customerMeta?.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
      version: 1,
    };

    const orderId = await this.dataStore.create<Order>(STORES.ORDERS, order);
    logger.info('Order created:', orderId);

    eventBus.emit('order:created', { orderId, order });
    return orderId;
  }

  /**
   * Update order status with conflict resolution
   */
  async updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
    const order = await this.dataStore.get<Order>(STORES.ORDERS, orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Conflict resolution: take higher status if both devices update
    const currentStatusValue = STATUS_ORDER[order.status];
    const newStatusValue = STATUS_ORDER[newStatus];

    if (newStatusValue <= currentStatusValue && order.status !== 'cancelled') {
      logger.warn(
        `Status update rejected: ${order.status} -> ${newStatus} (order ${orderId})`
      );
      return; // Don't downgrade status
    }

    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      updatedAt: Date.now(),
      version: (order.version || 1) + 1,
      synced: false,
    };

    if (newStatus === 'completed') {
      updatedOrder.completedAt = Date.now();
    }

    await this.dataStore.put(STORES.ORDERS, updatedOrder);
    logger.info(`Order ${orderId} status updated: ${order.status} -> ${newStatus}`);

    eventBus.emit('order:status-updated', { orderId, oldStatus: order.status, newStatus, order: updatedOrder });
  }

  /**
   * Update order (for notes, customer info, etc.)
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    const order = await this.dataStore.get<Order>(STORES.ORDERS, orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const updatedOrder: Order = {
      ...order,
      ...updates,
      updatedAt: Date.now(),
      version: (order.version || 1) + 1,
      synced: false,
    };

    await this.dataStore.put(STORES.ORDERS, updatedOrder);
    eventBus.emit('order:updated', { orderId, order: updatedOrder });
  }

  /**
   * Get active orders (pending, preparing, ready)
   */
  async getActiveOrders(): Promise<Order[]> {
    const pending = await this.dataStore.query<Order>(
      STORES.ORDERS,
      INDEXES.ORDERS_BY_STATUS,
      IDBKeyRange.only('pending')
    );
    const preparing = await this.dataStore.query<Order>(
      STORES.ORDERS,
      INDEXES.ORDERS_BY_STATUS,
      IDBKeyRange.only('preparing')
    );
    const ready = await this.dataStore.query<Order>(
      STORES.ORDERS,
      INDEXES.ORDERS_BY_STATUS,
      IDBKeyRange.only('ready')
    );

    return [...pending, ...preparing, ...ready].sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get completed orders (for history)
   */
  async getCompletedOrders(limit: number = 50): Promise<Order[]> {
    const completed = await this.dataStore.query<Order>(
      STORES.ORDERS,
      INDEXES.ORDERS_BY_STATUS,
      IDBKeyRange.only('completed')
    );

    return completed
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, limit);
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.dataStore.get<Order>(STORES.ORDERS, orderId);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    await this.updateOrderStatus(orderId, 'cancelled');
    if (reason) {
      const order = await this.getOrder(orderId);
      if (order) {
        await this.updateOrder(orderId, { notes: `${order.notes || ''}\nCancelled: ${reason}`.trim() });
      }
    }
  }

  /**
   * Mark order as synced (called by SyncEngine)
   */
  async markSynced(orderId: string, serverOrderId?: string): Promise<void> {
    const order = await this.dataStore.get<Order>(STORES.ORDERS, orderId);
    if (!order) return;

    const updatedOrder: Order = {
      ...order,
      synced: true,
      updatedAt: Date.now(),
    };

    // If server returned a different ID, update it
    if (serverOrderId && serverOrderId !== orderId) {
      // Delete old and create new with server ID
      await this.dataStore.delete(STORES.ORDERS, orderId);
      updatedOrder.id = serverOrderId;
      updatedOrder.tempId = orderId;
      await this.dataStore.put(STORES.ORDERS, updatedOrder);
    } else {
      await this.dataStore.put(STORES.ORDERS, updatedOrder);
    }
  }
}

// Singleton instance
let orderServiceInstance: OrderService | null = null;

export const getOrderService = (): OrderService => {
  if (!orderServiceInstance) {
    orderServiceInstance = new OrderService();
  }
  return orderServiceInstance;
};

