/**
 * KitchenDisplay - Kitchen order display screen
 */

import { useOrders } from '../../hooks/useOrders';
import { OrderCard } from '../orders/OrderCard';
import { SyncStatus } from '../common/SyncStatus';
import type { OrderStatus } from '../../domain/types';

export function KitchenDisplay() {
  const { activeOrders, loading, updateOrderStatus } = useOrders();

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, status);
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
    }
  };

  // Group orders by status
  const ordersByStatus = {
    pending: activeOrders.filter((o) => o.status === 'pending'),
    preparing: activeOrders.filter((o) => o.status === 'preparing'),
    ready: activeOrders.filter((o) => o.status === 'ready'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Kitchen Display</h1>
          <SyncStatus />
        </div>
      </header>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {/* Pending Column */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-yellow-700">
              Pending ({ordersByStatus.pending.length})
            </h2>
            <div className="space-y-3">
              {ordersByStatus.pending.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {ordersByStatus.pending.length === 0 && (
                <div className="text-center text-gray-400 py-8">No pending orders</div>
              )}
            </div>
          </div>

          {/* Preparing Column */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-blue-700">
              Preparing ({ordersByStatus.preparing.length})
            </h2>
            <div className="space-y-3">
              {ordersByStatus.preparing.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {ordersByStatus.preparing.length === 0 && (
                <div className="text-center text-gray-400 py-8">No orders in preparation</div>
              )}
            </div>
          </div>

          {/* Ready Column */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-green-700">
              Ready ({ordersByStatus.ready.length})
            </h2>
            <div className="space-y-3">
              {ordersByStatus.ready.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {ordersByStatus.ready.length === 0 && (
                <div className="text-center text-gray-400 py-8">No ready orders</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

