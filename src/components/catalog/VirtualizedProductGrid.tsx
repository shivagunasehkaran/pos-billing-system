/**
 * VirtualizedProductGrid - Efficient rendering of large product catalogs
 * Custom lightweight virtualization for product grid
 */

import { useState, useRef, useMemo } from 'react';
import type { Product } from '../../domain/types';
import { ProductCard } from './ProductCard';

interface VirtualizedProductGridProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
  containerWidth: number;
  containerHeight: number;
}

const ITEM_HEIGHT = 200;
const ITEM_GAP = 16;
const CONTAINER_PADDING = 16;

export function VirtualizedProductGrid({
  products,
  onProductSelect,
  containerWidth,
  containerHeight,
}: VirtualizedProductGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate grid dimensions - responsive
  const COLUMN_COUNT = 
    containerWidth > 1024 ? 4 :  // Desktop: 4 columns
    containerWidth > 768 ? 3 :   // Tablet: 3 columns
    containerWidth > 640 ? 2 :   // Small tablet: 2 columns
    2;                            // Mobile: 2 columns
  const COLUMN_WIDTH = Math.floor((containerWidth - CONTAINER_PADDING * 2) / COLUMN_COUNT) - ITEM_GAP;
  const ROW_COUNT = Math.ceil(products.length / COLUMN_COUNT);
  const TOTAL_HEIGHT = ROW_COUNT * (ITEM_HEIGHT + ITEM_GAP) + CONTAINER_PADDING * 2;

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / (ITEM_HEIGHT + ITEM_GAP)) - 1);
    const endRow = Math.min(
      ROW_COUNT - 1,
      Math.ceil((scrollTop + containerHeight) / (ITEM_HEIGHT + ITEM_GAP)) + 1
    );
    return { startRow, endRow };
  }, [scrollTop, containerHeight, ROW_COUNT]);

  // Get visible products
  const visibleProducts = useMemo(() => {
    const items: Array<{ product: Product; row: number; col: number; index: number }> = [];
    for (let row = visibleRange.startRow; row <= visibleRange.endRow; row++) {
      for (let col = 0; col < COLUMN_COUNT; col++) {
        const index = row * COLUMN_COUNT + col;
        if (index < products.length) {
          items.push({
            product: products[index],
            row,
            col,
            index,
          });
        }
      }
    }
    return items;
  }, [products, visibleRange, COLUMN_COUNT]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (products.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No products found
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="overflow-auto h-full w-full"
      style={{ height: containerHeight }}
    >
      <div style={{ height: TOTAL_HEIGHT, position: 'relative', padding: CONTAINER_PADDING }}>
        {visibleProducts.map(({ product, row, col }) => {
          const top = row * (ITEM_HEIGHT + ITEM_GAP);
          const left = col * (COLUMN_WIDTH + ITEM_GAP);

          return (
            <div
              key={product.id}
              style={{
                position: 'absolute',
                top,
                left,
                width: COLUMN_WIDTH,
                height: ITEM_HEIGHT,
              }}
            >
              <ProductCard product={product} onSelect={onProductSelect} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
