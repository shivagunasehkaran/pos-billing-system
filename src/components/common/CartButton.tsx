/**
 * CartButton - Desktop cart button for opening cart
 */

import { useCart } from '../../contexts/CartContext';

interface CartButtonProps {
  onClick: () => void;
  className?: string;
}

export function CartButton({ onClick, className = '' }: CartButtonProps) {
  const { getItemCount, getTotal } = useCart();
  const itemCount = getItemCount();

  return (
    <button
      onClick={onClick}
      className={`relative bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 active:scale-95 transition-transform flex items-center gap-2 ${className}`}
      style={{ touchAction: 'manipulation', minHeight: '44px' }}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span className="font-semibold">Cart</span>
      {itemCount > 0 && (
        <>
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {itemCount}
          </span>
          <span className="hidden sm:inline font-medium">${getTotal().toFixed(2)}</span>
        </>
      )}
    </button>
  );
}


