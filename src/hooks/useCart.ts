/**
 * useCart - Hook for managing shopping cart
 */

import { useState, useCallback } from 'react';
import type { OrderItem, Product } from '../domain/types';

export interface CartItem extends OrderItem {
  product: Product;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: Product, quantity: number = 1, modifiers?: OrderItem['modifiers'], notes?: string) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQuantity = existing.quantity + quantity;
        const newSubtotal = product.price * newQuantity + (modifiers?.reduce((sum, m) => sum + m.price, 0) || 0) * newQuantity;
        
        updated[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          subtotal: newSubtotal,
          modifiers: modifiers || existing.modifiers,
          notes: notes || existing.notes,
        };
        return updated;
      } else {
        // Add new item
        const modifierTotal = modifiers?.reduce((sum, m) => sum + m.price, 0) || 0;
        const subtotal = (product.price + modifierTotal) * quantity;
        
        const newItem: CartItem = {
          id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          product,
          quantity,
          price: product.price,
          subtotal,
          modifiers,
          notes,
        };
        return [...prev, newItem];
      }
    });
  }, []);

  const updateItem = useCallback((itemId: string, updates: Partial<CartItem>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates,
              subtotal: (item.product.price + (updates.modifiers || item.modifiers || []).reduce((sum, m) => sum + m.price, 0)) * (updates.quantity ?? item.quantity),
            }
          : item
      )
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }, [items]);

  const getItemCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return {
    items,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    getTotal,
    getItemCount,
    isEmpty: items.length === 0,
  };
}

