/**
 * ProductGrid - Smart grid that uses virtualization for large catalogs
 */

import { useState, useEffect, useRef } from 'react';
import type { Product } from '../../domain/types';
import { VirtualizedProductGrid } from './VirtualizedProductGrid';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
}

const VIRTUALIZATION_THRESHOLD = 50; // Use virtualization for 50+ products

export function ProductGrid({ products, onProductSelect }: ProductGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Use virtualization for large catalogs
  if (products.length >= VIRTUALIZATION_THRESHOLD && dimensions.width > 0) {
    return (
      <div ref={containerRef} className="h-full w-full">
        <VirtualizedProductGrid
          products={products}
          onProductSelect={onProductSelect}
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
        />
      </div>
    );
  }

  // Regular grid for small catalogs
  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-2 md:p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={onProductSelect}
          />
        ))}
      </div>
      {products.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No products found
        </div>
      )}
    </div>
  );
}

