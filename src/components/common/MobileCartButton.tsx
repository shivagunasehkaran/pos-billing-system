/**
 * MobileCartButton - Floating cart button for mobile devices
 */

import { useCart } from '../../contexts/CartContext';

interface MobileCartButtonProps {
  onClick: () => void;
}

export function MobileCartButton({ onClick }: MobileCartButtonProps) {
  const { getItemCount, getTotal } = useCart();

  const itemCount = getItemCount();
  if (itemCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 md:hidden z-40 bg-blue-600 text-white px-6 py-4 rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-transform flex items-center gap-3 min-h-[56px]"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium">Cart</span>
        <span className="text-xs opacity-90">{itemCount} items</span>
      </div>
      <div className="text-lg font-bold">${getTotal().toFixed(2)}</div>
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {itemCount}
        </span>
      )}
    </button>
  );
}


