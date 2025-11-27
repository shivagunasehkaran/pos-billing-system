/**
 * Shared domain types
 */

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  subtotal: number;
  tax: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  version?: number; // For conflict resolution
  synced?: boolean;
  tempId?: string; // For offline creates
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  modifiers?: OrderItemModifier[];
  notes?: string;
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  available: boolean;
  modifiers?: ProductModifier[];
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProductModifier {
  id: string;
  name: string;
  price: number;
  required?: boolean;
}

export interface InventoryItem {
  id: string;
  productId: string;
  quantity: number;
  reserved: number; // Reserved for pending orders
  lastUpdated: number;
  version?: number;
}

export interface InventoryDelta {
  productId: string;
  delta: number; // Positive for additions, negative for subtractions
  reason: string;
  orderId?: string;
}

export interface PrintJob {
  id: string;
  type: 'receipt' | 'kitchen' | 'bar';
  orderId: string;
  payload: string; // ESC/POS commands or rendered template
  status: 'pending' | 'printing' | 'completed' | 'failed';
  priority: number; // Higher = more priority
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
  printerId?: string;
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncTime?: number;
  pendingOperationsCount: number;
  lastError?: string;
  syncCursors: {
    orders?: string;
    inventory?: string;
    menu?: string;
  };
}

