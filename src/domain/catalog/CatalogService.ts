/**
 * CatalogService - Manages product catalog, search, and filtering
 */

import { getDataStore } from '../../data/OfflineDataStore';
import { STORES, INDEXES } from '../../data/dbConfig';
import type { Product } from '../types';
import { eventBus } from '../../utils/eventBus';
import { logger } from '../../utils/logger';

export class CatalogService {
  private dataStore = getDataStore();
  private searchIndex: Map<string, string[]> = new Map(); // category -> product IDs
  private nameIndex: Map<string, string> = new Map(); // lowercase name -> product ID

  /**
   * Initialize catalog (load all products into memory for fast search)
   */
  async initialize(): Promise<void> {
    const products = await this.dataStore.getAll<Product>(STORES.PRODUCTS);
    this.buildIndexes(products);
    logger.info(`Catalog initialized with ${products.length} products`);
  }

  /**
   * Build in-memory indexes for fast search
   */
  private buildIndexes(products: Product[]): void {
    this.searchIndex.clear();
    this.nameIndex.clear();

    products.forEach((product) => {
      // Category index
      if (!this.searchIndex.has(product.category)) {
        this.searchIndex.set(product.category, []);
      }
      this.searchIndex.get(product.category)!.push(product.id);

      // Name index (lowercase for case-insensitive search)
      this.nameIndex.set(product.name.toLowerCase(), product.id);
    });
  }

  /**
   * Get all products
   */
  async getAllProducts(): Promise<Product[]> {
    return this.dataStore.getAll<Product>(STORES.PRODUCTS);
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string): Promise<Product[]> {
    const products = await this.dataStore.query<Product>(
      STORES.PRODUCTS,
      INDEXES.PRODUCTS_BY_CATEGORY,
      IDBKeyRange.only(category)
    );
    return products.filter((p) => p.available);
  }

  /**
   * Search products by name (prefix-based)
   */
  async searchProducts(query: string): Promise<Product[]> {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      return this.getAllProducts();
    }

    const allProducts = await this.getAllProducts();
    return allProducts.filter(
      (product) =>
        product.available &&
        product.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<Product | undefined> {
    return this.dataStore.get<Product>(STORES.PRODUCTS, productId);
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const products = await this.getAllProducts();
    const categories = new Set<string>();
    products.forEach((product) => {
      if (product.available) {
        categories.add(product.category);
      }
    });
    return Array.from(categories).sort();
  }

  /**
   * Update product availability (local override)
   */
  async setProductAvailability(productId: string, available: boolean): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const updatedProduct: Product = {
      ...product,
      available,
      updatedAt: Date.now(),
    };

    await this.dataStore.put(STORES.PRODUCTS, updatedProduct);
    eventBus.emit('catalog:product-updated', { productId, product: updatedProduct });
  }

  /**
   * Sync products from server (overwrites local)
   */
  async syncProducts(products: Product[]): Promise<void> {
    await this.dataStore.runTransaction([STORES.PRODUCTS], async (tx) => {
      const store = tx.objectStore(STORES.PRODUCTS);
      
      // Clear existing products
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Add new products
      await Promise.all(
        products.map(
          (product) =>
            new Promise<void>((resolve, reject) => {
              const request = store.put(product);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            })
        )
      );
    });

    // Rebuild indexes
    this.buildIndexes(products);
    logger.info(`Synced ${products.length} products from server`);
    eventBus.emit('catalog:synced', { count: products.length });
  }
}

// Singleton instance
let catalogServiceInstance: CatalogService | null = null;

export const getCatalogService = (): CatalogService => {
  if (!catalogServiceInstance) {
    catalogServiceInstance = new CatalogService();
  }
  return catalogServiceInstance;
};

