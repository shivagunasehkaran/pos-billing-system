/**
 * useCatalog - Hook for product catalog
 */

import { useState, useEffect, useCallback } from 'react';
import type { Product } from '../domain/types';
import { getCatalogService } from '../domain/catalog/CatalogService';
import { eventBus } from '../utils/eventBus';

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const catalogService = getCatalogService();

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      await catalogService.initialize();
      const allProducts = await catalogService.getAllProducts();
      setProducts(allProducts);
      const cats = await catalogService.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }, [catalogService]);

  const getFilteredProducts = useCallback(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(query));
    }

    // Only show available products
    return filtered.filter((p) => p.available);
  }, [products, selectedCategory, searchQuery]);

  useEffect(() => {
    loadProducts();

    // Subscribe to catalog updates
    const unsubscribe = eventBus.on('catalog:synced', () => {
      loadProducts();
    });

    return unsubscribe;
  }, [loadProducts]);

  return {
    products: getFilteredProducts(),
    allProducts: products,
    categories,
    loading,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    refresh: loadProducts,
  };
}

