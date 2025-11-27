/**
 * useOrders - Hook for managing orders
 */

import { useState, useEffect, useCallback } from 'react';
import type { Order, OrderStatus } from '../domain/types';
import { getOrderService } from '../domain/orders/OrderService';
import { eventBus } from '../utils/eventBus';

export function useOrders() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const orderService = getOrderService();

  const loadActiveOrders = useCallback(async () => {
    try {
      const orders = await orderService.getActiveOrders();
      setActiveOrders(orders);
    } catch (error) {
      console.error('Failed to load active orders:', error);
    }
  }, [orderService]);

  const loadCompletedOrders = useCallback(async (limit: number = 50) => {
    try {
      const orders = await orderService.getCompletedOrders(limit);
      setCompletedOrders(orders);
    } catch (error) {
      console.error('Failed to load completed orders:', error);
    }
  }, [orderService]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, status);
      await loadActiveOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      throw error;
    }
  }, [orderService, loadActiveOrders]);

  const getOrder = useCallback(async (orderId: string) => {
    return orderService.getOrder(orderId);
  }, [orderService]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadActiveOrders(), loadCompletedOrders()]);
      setLoading(false);
    };

    loadData();

    // Subscribe to order events
    const unsubscribeCreated = eventBus.on('order:created', () => {
      loadActiveOrders();
    });

    const unsubscribeUpdated = eventBus.on('order:updated', () => {
      loadActiveOrders();
    });

    const unsubscribeStatusUpdated = eventBus.on('order:status-updated', () => {
      loadActiveOrders();
      loadCompletedOrders();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeStatusUpdated();
    };
  }, [loadActiveOrders, loadCompletedOrders]);

  return {
    activeOrders,
    completedOrders,
    loading,
    updateOrderStatus,
    getOrder,
    refresh: loadActiveOrders,
  };
}

