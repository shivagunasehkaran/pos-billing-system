/**
 * ProductCustomizationModal - Modal for customizing product before adding to cart
 */

import { useState, useMemo } from 'react';
import type { Product, ProductModifier, OrderItemModifier } from '../../domain/types';

interface ProductCustomizationModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, modifiers?: OrderItemModifier[], notes?: string) => void;
}

export function ProductCustomizationModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductCustomizationModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, ProductModifier>>(new Map());
  const [notes, setNotes] = useState('');

  // Calculate total price including modifiers
  const totalPrice = useMemo(() => {
    const modifierTotal = Array.from(selectedModifiers.values()).reduce(
      (sum, mod) => sum + mod.price,
      0
    );
    return (product.price + modifierTotal) * quantity;
  }, [product.price, selectedModifiers, quantity]);

  // Get required modifiers that aren't selected
  const missingRequiredModifiers = useMemo(() => {
    if (!product.modifiers) return [];
    return product.modifiers.filter(
      (mod) => mod.required && !selectedModifiers.has(mod.id)
    );
  }, [product.modifiers, selectedModifiers]);

  const handleModifierToggle = (modifier: ProductModifier) => {
    const newSelected = new Map(selectedModifiers);
    if (newSelected.has(modifier.id)) {
      newSelected.delete(modifier.id);
    } else {
      newSelected.set(modifier.id, modifier);
    }
    setSelectedModifiers(newSelected);
  };

  const handleAddToCart = () => {
    // Check required modifiers
    if (missingRequiredModifiers.length > 0) {
      alert(`Please select: ${missingRequiredModifiers.map((m) => m.name).join(', ')}`);
      return;
    }

    const modifiers: OrderItemModifier[] = Array.from(selectedModifiers.values()).map((mod) => ({
      id: mod.id,
      name: mod.name,
      price: mod.price,
    }));

    onAddToCart(product, quantity, modifiers, notes.trim() || undefined);
    handleClose();
  };

  const handleClose = () => {
    setQuantity(1);
    setSelectedModifiers(new Map());
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 md:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{product.name}</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          {product.description && (
            <p className="text-gray-600">{product.description}</p>
          )}

          {/* Base Price */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="font-medium">Base Price</span>
            <span className="font-semibold">${product.price.toFixed(2)}</span>
          </div>

          {/* Modifiers */}
          {product.modifiers && product.modifiers.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Add-ons</h3>
              <div className="space-y-2">
                {product.modifiers.map((modifier) => {
                  const isSelected = selectedModifiers.has(modifier.id);
                  const isRequired = modifier.required;

                  return (
                    <label
                      key={modifier.id}
                      className={`
                        flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer
                        transition-all
                        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                        ${isRequired ? 'border-orange-300' : ''}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleModifierToggle(modifier)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium">
                            {modifier.name}
                            {isRequired && <span className="text-orange-600 ml-1">*</span>}
                          </span>
                        </div>
                      </div>
                      <span className="font-semibold text-blue-600">
                        {modifier.price > 0 ? `+$${modifier.price.toFixed(2)}` : 'Free'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Requests / Notes */}
          <div>
            <label className="block font-semibold mb-2">Special Requests</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block font-semibold mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-semibold"
              >
                −
              </button>
              <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-semibold"
              >
                +
              </button>
            </div>
          </div>

          {/* Total Price */}
          <div className="flex justify-between items-center py-3 border-t-2 border-gray-200">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold text-blue-600">${totalPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t p-3 md:p-4 flex gap-2 md:gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 md:py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 text-base"
            style={{ touchAction: 'manipulation', minHeight: '48px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleAddToCart}
            disabled={missingRequiredModifiers.length > 0}
            className="flex-1 px-4 py-3 md:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            style={{ touchAction: 'manipulation', minHeight: '48px' }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

