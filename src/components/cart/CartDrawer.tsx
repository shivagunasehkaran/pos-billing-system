/**
 * CartDrawer - Mobile-friendly cart drawer/bottom sheet
 */

import { useCart } from '../../contexts/CartContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
  checkingOut?: boolean;
}

export function CartDrawer({ isOpen, onClose, onCheckout, checkingOut = false }: CartDrawerProps) {
  const { items, updateItem, removeItem, clearCart, getTotal, isEmpty } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl md:hidden max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-semibold">Cart</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={clearCart}
              className="text-sm text-red-600 hover:text-red-700 px-3 py-1"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {isEmpty ? (
            <div className="text-center text-gray-500 py-8">
              <p>Cart is empty</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{item.productName}</h4>
                    <p className="text-sm text-gray-600">${item.product.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                      className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg font-semibold"
                      style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-medium text-lg">{item.quantity}</span>
                    <button
                      onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                      className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg font-semibold"
                      style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
                    >
                      +
                    </button>
                  </div>
                  <div className="w-20 text-right">
                    <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-600 hover:text-red-700 p-2"
                    style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Modifiers Display */}
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="ml-2 pl-2 border-l-2 border-blue-200">
                    <p className="text-xs text-gray-500 mb-1">Add-ons:</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {item.modifiers.map((mod) => (
                        <li key={mod.id}>
                          • {mod.name} {mod.price > 0 && <span className="text-blue-600">(+${mod.price.toFixed(2)})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes Display */}
                {item.notes && (
                  <div className="ml-2 pl-2 border-l-2 border-orange-200">
                    <p className="text-xs text-gray-500 mb-1">Note:</p>
                    <p className="text-xs text-gray-600 italic">{item.notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer with Checkout */}
        {!isEmpty && (
          <div className="px-4 py-4 border-t bg-gray-50 flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Total:</span>
              <span className="text-2xl font-bold text-blue-600">${getTotal().toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              disabled={checkingOut}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ touchAction: 'manipulation', minHeight: '56px' }}
            >
              {checkingOut ? 'Processing...' : 'Checkout'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}


