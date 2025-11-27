/**
 * OrderEntry - Main POS screen with catalog and cart
 */

import { useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { useCart } from '../../contexts/CartContext';
import { ProductGrid } from '../catalog/ProductGrid';
import { ProductCustomizationModal } from '../catalog/ProductCustomizationModal';
import { CartView } from '../cart/CartView';
import { CartDrawer } from '../cart/CartDrawer';
import { MobileCartButton } from '../common/MobileCartButton';
import { CartButton } from '../common/CartButton';
import { SyncStatus } from '../common/SyncStatus';
import { getOrderService } from '../../domain/orders/OrderService';
import { getPrintJobManager } from '../../domain/print/PrintJobManager';
import type { Product, OrderItemModifier } from '../../domain/types';

export function OrderEntry() {
  const { products, categories, loading, selectedCategory, setSelectedCategory, searchQuery, setSearchQuery } = useCatalog();
  const { items, addItem, clearCart } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false); // Desktop cart visibility - hidden by default

  const orderService = getOrderService();
  const printManager = getPrintJobManager();

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = (product: Product, quantity: number, modifiers?: OrderItemModifier[], notes?: string) => {
    addItem(product, quantity, modifiers, notes);
    // Don't auto-show cart - user must click cart button
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;

    setCheckingOut(true);
    try {
      // Convert cart items to order items
      const orderItems = items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        modifiers: item.modifiers,
        notes: item.notes,
      }));

      // Create order
      const orderId = await orderService.createOrder(orderItems);

      // Get the created order
      const order = await orderService.getOrder(orderId);
      if (order) {
        // Queue print jobs
        await printManager.enqueue('receipt', order, { priority: 1 });
        await printManager.enqueue('kitchen', order, { priority: 3 });
      }

      // Clear cart
      clearCart();

      alert(`Order #${orderId.slice(-6)} created successfully!`);
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading catalog...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm p-3 md:p-4 flex-shrink-0">
        <div className="flex justify-between items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold">POS System</h1>
          <div className="flex items-center gap-2">
            {/* Desktop Cart Button */}
            <div className="hidden md:block">
              <CartButton onClick={() => setIsCartVisible(true)} />
            </div>
            <div className="hidden md:block">
              <SyncStatus />
            </div>
            <div className="md:hidden text-sm">
              <SyncStatus />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{ minHeight: 0 }}>
        {/* Catalog Section */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Search and Filters */}
          <div className="bg-white p-3 md:p-4 border-b flex-shrink-0">
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                style={{ touchAction: 'manipulation' }}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2.5 md:py-2 rounded-lg whitespace-nowrap text-sm md:text-base ${
                  selectedCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2.5 md:py-2 rounded-lg whitespace-nowrap text-sm md:text-base ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  style={{ touchAction: 'manipulation', minHeight: '44px' }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-hidden">
            <ProductGrid
              products={products}
              onProductSelect={handleProductSelect}
            />
          </div>
        </div>

        {/* Cart Section - Desktop Only */}
        {isCartVisible && (
          <div className="hidden md:flex w-96 border-l bg-gray-50 flex-col overflow-hidden" style={{ minHeight: 0 }}>
            <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
              <CartView 
                onCheckout={handleCheckout} 
                checkingOut={checkingOut}
                onClose={() => setIsCartVisible(false)}
                showCloseButton={true}
              />
            </div>
          </div>
        )}

      </div>

      {/* Mobile Cart Button */}
      <MobileCartButton onClick={() => setIsCartDrawerOpen(true)} />

      {/* Mobile Cart Drawer */}
      <CartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
        onCheckout={async () => {
          setIsCartDrawerOpen(false);
          await handleCheckout();
        }}
        checkingOut={checkingOut}
      />

      {/* Product Customization Modal */}
      {selectedProduct && (
        <ProductCustomizationModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}

