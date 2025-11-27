/**
 * OrderCard - Displays a single order
 */

import type { Order } from '../../domain/types';

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: string, status: Order['status']) => void;
  showActions?: boolean;
}

export function OrderCard({ order, onStatusChange, showActions = true }: OrderCardProps) {
  const statusColors: Record<Order['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    preparing: 'bg-blue-100 text-blue-800',
    ready: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const getNextStatus = (current: Order['status']): Order['status'] | null => {
    const transitions: Record<Order['status'], Order['status'] | null> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'completed',
      completed: null,
      cancelled: null,
    };
    return transitions[current];
  };

  const nextStatus = getNextStatus(order.status);

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-lg">Order #{order.id.slice(-6)}</h3>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[order.status]}`}>
          {order.status}
        </span>
      </div>

      <div className="mb-3">
        <ul className="space-y-1">
          {order.items.map((item) => (
            <li key={item.id} className="text-sm">
              <span className="font-medium">{item.productName}</span>
              <span className="text-gray-500"> x{item.quantity}</span>
              <span className="text-gray-600 ml-2">${item.subtotal.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between items-center pt-2 border-t">
        <div className="text-sm">
          <span className="text-gray-600">Total: </span>
          <span className="font-semibold">${order.total.toFixed(2)}</span>
        </div>
        {showActions && nextStatus && onStatusChange && (
          <button
            onClick={() => onStatusChange(order.id, nextStatus)}
            className="px-4 py-2.5 md:py-1 bg-blue-600 text-white rounded text-sm md:text-sm hover:bg-blue-700 active:scale-95 transition-transform"
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            Mark {nextStatus}
          </button>
        )}
      </div>

      {order.notes && (
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs text-gray-600 italic">{order.notes}</p>
        </div>
      )}

      {!order.synced && (
        <div className="mt-2">
          <span className="text-xs text-orange-600">⏳ Unsynced</span>
        </div>
      )}
    </div>
  );
}

