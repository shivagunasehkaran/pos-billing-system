/**
 * CartView - Shopping cart display and management
 */

import { useCart } from '../../contexts/CartContext';

interface CartViewProps {
  onCheckout: () => void;
  checkingOut?: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function CartView({ onCheckout, checkingOut = false, onClose, showCloseButton = false }: CartViewProps) {
  const { items, updateItem, removeItem, clearCart, getTotal, isEmpty } = useCart();

  if (isEmpty) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Cart is empty</p>
        </div>
        {showCloseButton && onClose && (
          <div className="p-4 border-t">
            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              Close Cart
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-full" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="p-4 border-b flex justify-between items-center" style={{ flexShrink: 0 }}>
        <h2 className="text-xl font-semibold">Cart</h2>
        <div className="flex items-center gap-2">
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Close cart"
              style={{ touchAction: 'manipulation', minWidth: '32px', minHeight: '32px' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={clearCart}
            className="text-sm text-red-600 hover:text-red-700 px-2 py-1"
            style={{ touchAction: 'manipulation' }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0, flex: '1 1 auto', overflowY: 'auto' }}>
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h4 className="font-medium">{item.productName}</h4>
                <p className="text-sm text-gray-600">${item.product.price.toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                  className="w-9 h-9 md:w-8 md:h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg md:text-base"
                  style={{ touchAction: 'manipulation', minWidth: '36px', minHeight: '36px' }}
                >
                  −
                </button>
                <span className="w-9 md:w-8 text-center font-medium text-base md:text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                  className="w-9 h-9 md:w-8 md:h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg md:text-base"
                  style={{ touchAction: 'manipulation', minWidth: '36px', minHeight: '36px' }}
                >
                  +
                </button>
              </div>
              <div className="w-20 text-right">
                <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="text-red-600 hover:text-red-700 p-1"
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
        ))}
      </div>

      <div className="p-4 border-t bg-gray-50" style={{ flexShrink: 0, marginTop: 'auto' }}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold">Total:</span>
          <span className="text-2xl font-bold text-blue-600">${getTotal().toFixed(2)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={checkingOut}
          className="w-full py-3 md:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed text-base"
          style={{ touchAction: 'manipulation', minHeight: '48px' }}
        >
          {checkingOut ? 'Processing...' : 'Checkout'}
        </button>
      </div>
    </div>
  );
}

