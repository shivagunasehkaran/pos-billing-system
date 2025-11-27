/**
 * ProductCard - Displays a product in the catalog
 */

import { memo } from 'react';
import type { Product } from '../../domain/types';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard = memo(function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <button
      onClick={() => onSelect(product)}
      disabled={!product.available}
      className={`
        bg-white rounded-lg shadow p-3 md:p-4 border-2 border-gray-200
        hover:border-blue-500 hover:shadow-md
        active:scale-95 transition-all
        text-left w-full
        ${!product.available ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={{ touchAction: 'manipulation', minHeight: '120px' }}
    >
      {product.imageUrl && (
        <div className="w-full h-32 bg-gray-100 rounded mb-2 overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
      {product.description && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
      )}
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold text-blue-600">${product.price.toFixed(2)}</span>
        {!product.available && (
          <span className="text-xs text-red-600">Unavailable</span>
        )}
      </div>
    </button>
  );
});

