/**
 * Initialize sample data for development/testing
 */

import { getDataStore } from '../data/OfflineDataStore';
import { STORES } from '../data/dbConfig';
import type { Product, InventoryItem } from '../domain/types';
import { getCatalogService } from '../domain/catalog/CatalogService';
import { getInventoryService } from '../domain/inventory/InventoryService';

export async function initSampleData() {
  const dataStore = getDataStore();
  await dataStore.init();

  // Sample products
  const sampleProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'Burger',
      description: 'Classic beef burger',
      price: 12.99,
      category: 'Main',
      available: true,
      modifiers: [
        { id: 'mod-1-1', name: 'Extra Cheese', price: 1.50, required: false },
        { id: 'mod-1-2', name: 'Bacon', price: 2.00, required: false },
        { id: 'mod-1-3', name: 'Avocado', price: 1.75, required: false },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'prod-2',
      name: 'Pizza',
      description: 'Margherita pizza',
      price: 15.99,
      category: 'Main',
      available: true,
      modifiers: [
        { id: 'mod-2-1', name: 'Extra Cheese', price: 2.00, required: false },
        { id: 'mod-2-2', name: 'Pepperoni', price: 2.50, required: false },
        { id: 'mod-2-3', name: 'Mushrooms', price: 1.50, required: false },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'prod-3',
      name: 'Fries',
      description: 'Crispy french fries',
      price: 4.99,
      category: 'Sides',
      available: true,
      modifiers: [
        { id: 'mod-3-1', name: 'Large Size', price: 1.50, required: false },
        { id: 'mod-3-2', name: 'Cheese Sauce', price: 1.00, required: false },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'prod-4',
      name: 'Coca Cola',
      description: 'Soft drink',
      price: 2.99,
      category: 'Drinks',
      available: true,
      modifiers: [
        { id: 'mod-4-1', name: 'Large Size', price: 0.50, required: false },
        { id: 'mod-4-2', name: 'Diet', price: 0, required: false },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'prod-5',
      name: 'Salad',
      description: 'Fresh garden salad',
      price: 8.99,
      category: 'Main',
      available: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'prod-6',
      name: 'Ice Cream',
      description: 'Vanilla ice cream',
      price: 5.99,
      category: 'Dessert',
      available: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  // Sample inventory
  const sampleInventory: InventoryItem[] = [
    {
      id: 'inv-1',
      productId: 'prod-1',
      quantity: 50,
      reserved: 0,
      lastUpdated: Date.now(),
    },
    {
      id: 'inv-2',
      productId: 'prod-2',
      quantity: 30,
      reserved: 0,
      lastUpdated: Date.now(),
    },
    {
      id: 'inv-3',
      productId: 'prod-3',
      quantity: 100,
      reserved: 0,
      lastUpdated: Date.now(),
    },
    {
      id: 'inv-4',
      productId: 'prod-4',
      quantity: 200,
      reserved: 0,
      lastUpdated: Date.now(),
    },
    {
      id: 'inv-5',
      productId: 'prod-5',
      quantity: 40,
      reserved: 0,
      lastUpdated: Date.now(),
    },
    {
      id: 'inv-6',
      productId: 'prod-6',
      quantity: 60,
      reserved: 0,
      lastUpdated: Date.now(),
    },
  ];

  // Check if data already exists
  const existingProducts = await dataStore.getAll<Product>(STORES.PRODUCTS);
  if (existingProducts.length > 0) {
    console.log('Sample data already exists, skipping initialization');
    return;
  }

  // Initialize products
  const catalogService = getCatalogService();
  await catalogService.syncProducts(sampleProducts);

  // Initialize inventory
  const inventoryService = getInventoryService();
  await inventoryService.syncInventory(sampleInventory);

  console.log('Sample data initialized');
}

