/**
 * SyncEngine - Coordinates local changes vs server, handles conflict resolution
 */

import { getDataStore } from "../../data/OfflineDataStore";
import { STORES } from "../../data/dbConfig";
import type { SyncState, Order } from "../types";
import { getOrderService } from "../orders/OrderService";
import { getCatalogService } from "../catalog/CatalogService";
import { getInventoryService } from "../inventory/InventoryService";
import { eventBus } from "../../utils/eventBus";
import { logger } from "../../utils/logger";
import { isOnline, waitForOnline, retryWithBackoff } from "../../utils/network";

interface SyncConfig {
  apiBaseUrl: string;
  syncInterval?: number; // Auto-sync interval in ms
  enableWebSocket?: boolean;
  webSocketUrl?: string;
}

export class SyncEngine {
  private dataStore = getDataStore();
  private config: SyncConfig;
  private syncState: SyncState = {
    isSyncing: false,
    pendingOperationsCount: 0,
    syncCursors: {},
  };
  private syncIntervalId?: number;
  private webSocket?: WebSocket;

  constructor(config: SyncConfig) {
    this.config = config;
    this.setupEventListeners();
  }

  /**
   * Initialize sync engine
   */
  async initialize(): Promise<void> {
    await this.dataStore.init();

    // Load sync state
    const savedState = await this.dataStore.getSyncState<SyncState>(
      "syncState"
    );
    if (savedState) {
      this.syncState = { ...this.syncState, ...savedState };
    }

    // Start auto-sync if configured
    if (this.config.syncInterval) {
      this.startAutoSync();
    }

    // Connect WebSocket if enabled
    if (this.config.enableWebSocket && this.config.webSocketUrl) {
      this.connectWebSocket();
    }

    // Initial sync attempt
    if (isOnline()) {
      this.sync().catch((error) => {
        logger.error("Initial sync failed:", error);
      });
    }
  }

  /**
   * Perform full sync (push local changes, pull server updates)
   */
  async sync(): Promise<void> {
    if (this.syncState.isSyncing) {
      logger.debug("Sync already in progress");
      return;
    }

    if (!isOnline()) {
      logger.debug("Offline, skipping sync");
      return;
    }

    this.syncState.isSyncing = true;
    this.emitSyncState();

    try {
      // Push local changes
      await this.pushLocalChanges();

      // Pull server updates
      await this.pullServerUpdates();

      this.syncState.lastSyncTime = Date.now();
      this.syncState.lastError = undefined;
      logger.info("Sync completed successfully");
      eventBus.emit("sync:success", { syncState: this.syncState });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.syncState.lastError = errorMessage;
      logger.error("Sync failed:", error);
      eventBus.emit("sync:error", {
        error: errorMessage,
        syncState: this.syncState,
      });
    } finally {
      this.syncState.isSyncing = false;
      this.updatePendingCount();
      this.emitSyncState();
      await this.saveSyncState();
    }
  }

  /**
   * Push local changes to server
   */
  private async pushLocalChanges(): Promise<void> {
    const operations = await this.dataStore.getOutboxOperations();
    if (operations.length === 0) {
      return;
    }

    logger.info(`Pushing ${operations.length} local changes to server`);

    // Group operations by entity type
    const grouped = operations.reduce((acc, op) => {
      if (!acc[op.entityType]) {
        acc[op.entityType] = [];
      }
      acc[op.entityType].push(op);
      return acc;
    }, {} as Record<string, typeof operations>);

    const committedIds: string[] = [];

    // Push each group
    for (const [entityType, ops] of Object.entries(grouped)) {
      try {
        const response = await retryWithBackoff(async () => {
          console.log("this.config.apiBaseUrl", this.config.apiBaseUrl);
          const res = await fetch(`${this.config.apiBaseUrl}/sync/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deviceId: this.dataStore.getDeviceId(),
              operations: ops,
            }),
          });

          if (!res.ok) {
            throw new Error(`Sync push failed: ${res.statusText}`);
          }

          return res.json();
        });

        // Mark operations as committed
        committedIds.push(...ops.map((op) => op.id));

        // Handle server responses (e.g., canonical IDs for orders)
        if (response.updates) {
          await this.applyServerUpdates(response.updates);
        }
      } catch (error) {
        logger.error(`Failed to push ${entityType} operations:`, error);
        // Continue with other entity types
      }
    }

    // Clear committed operations from outbox
    if (committedIds.length > 0) {
      await this.dataStore.clearOutboxOperations(committedIds);
      logger.info(
        `Cleared ${committedIds.length} committed operations from outbox`
      );
    }
  }

  /**
   * Pull updates from server
   */
  private async pullServerUpdates(): Promise<void> {
    const cursors = this.syncState.syncCursors;

    try {
      // Pull orders
      const ordersResponse = await fetch(
        `${this.config.apiBaseUrl}/sync/orders?since=${cursors.orders || ""}`
      );
      if (ordersResponse.ok) {
        const data = await ordersResponse.json();
        if (data.orders && data.orders.length > 0) {
          await this.applyOrderUpdates(data.orders);
          this.syncState.syncCursors.orders = data.cursor;
        }
      }

      // Pull products/menu
      const menuResponse = await fetch(
        `${this.config.apiBaseUrl}/sync/menu?since=${cursors.menu || ""}`
      );
      if (menuResponse.ok) {
        const data = await menuResponse.json();
        if (data.products && data.products.length > 0) {
          const catalogService = getCatalogService();
          await catalogService.syncProducts(data.products);
          this.syncState.syncCursors.menu = data.cursor;
        }
      }

      // Pull inventory
      const inventoryResponse = await fetch(
        `${this.config.apiBaseUrl}/sync/inventory?since=${
          cursors.inventory || ""
        }`
      );
      if (inventoryResponse.ok) {
        const data = await inventoryResponse.json();
        if (data.inventory && data.inventory.length > 0) {
          const inventoryService = getInventoryService();
          await inventoryService.syncInventory(data.inventory);
          this.syncState.syncCursors.inventory = data.cursor;
        }
      }
    } catch (error) {
      logger.error("Failed to pull server updates:", error);
      throw error;
    }
  }

  /**
   * Apply server updates to local store
   */
  private async applyServerUpdates(
    updates: Array<{ entityType: string; entityId: string; serverId?: string }>
  ): Promise<void> {
    const orderService = getOrderService();

    for (const update of updates) {
      if (update.entityType === STORES.ORDERS && update.serverId) {
        // Update order ID from temp to server ID
        await orderService.markSynced(update.entityId, update.serverId);
      }
    }
  }

  /**
   * Apply order updates from server (with conflict resolution)
   */
  private async applyOrderUpdates(serverOrders: Order[]): Promise<void> {
    const orderService = getOrderService();

    for (const serverOrder of serverOrders) {
      const localOrder = await orderService.getOrder(serverOrder.id);

      if (!localOrder) {
        // New order from server
        await this.dataStore.put(STORES.ORDERS, {
          ...serverOrder,
          synced: true,
        });
        eventBus.emit("order:created", {
          orderId: serverOrder.id,
          order: serverOrder,
        });
      } else {
        // Conflict resolution: take server version if newer
        const serverVersion = serverOrder.version || 1;
        const localVersion = localOrder.version || 1;

        if (serverVersion >= localVersion || !localOrder.synced) {
          // Server wins
          await this.dataStore.put(STORES.ORDERS, {
            ...serverOrder,
            synced: true,
          });
          eventBus.emit("order:updated", {
            orderId: serverOrder.id,
            order: serverOrder,
          });
        } else {
          // Local has newer version, keep it (will be pushed on next sync)
          logger.debug(
            `Keeping local version of order ${serverOrder.id} (local v${localVersion} vs server v${serverVersion})`
          );
        }
      }
    }
  }

  /**
   * Update pending operations count
   */
  private async updatePendingCount(): Promise<void> {
    const operations = await this.dataStore.getOutboxOperations();
    this.syncState.pendingOperationsCount = operations.length;
  }

  /**
   * Emit sync state to event bus
   */
  private emitSyncState(): void {
    eventBus.emit("sync:state-changed", this.syncState);
  }

  /**
   * Save sync state to IndexedDB
   */
  private async saveSyncState(): Promise<void> {
    await this.dataStore.setSyncState("syncState", this.syncState);
  }

  /**
   * Start auto-sync interval
   */
  private startAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = window.setInterval(() => {
      if (isOnline()) {
        this.sync().catch((error) => {
          logger.error("Auto-sync failed:", error);
        });
      }
    }, this.config.syncInterval || 30000); // Default 30s
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  private connectWebSocket(): void {
    if (!this.config.webSocketUrl) return;

    const ws = new WebSocket(this.config.webSocketUrl);

    ws.onopen = () => {
      logger.info("WebSocket connected");
      this.webSocket = ws;
      eventBus.emit("sync:websocket-connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        logger.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      logger.error("WebSocket error:", error);
      eventBus.emit("sync:websocket-error", { error });
    };

    ws.onclose = () => {
      logger.info("WebSocket disconnected, reconnecting...");
      this.webSocket = undefined;
      eventBus.emit("sync:websocket-disconnected");

      // Reconnect after delay
      setTimeout(() => {
        if (isOnline()) {
          this.connectWebSocket();
        }
      }, 5000);
    };
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case "order_created":
      case "order_updated":
        // Trigger sync to get latest data
        this.sync().catch((error) => {
          logger.error("Sync triggered by WebSocket failed:", error);
        });
        break;
      default:
        logger.debug("Unknown WebSocket message type:", message.type);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener("online", () => {
      logger.info("Network online, triggering sync");
      this.sync().catch((error) => {
        logger.error("Sync on online event failed:", error);
      });
    });

    window.addEventListener("offline", () => {
      logger.info("Network offline");
      eventBus.emit("sync:offline");
    });

    // Listen for outbox changes
    eventBus.on("outbox:operation-queued", () => {
      this.updatePendingCount();
      this.emitSyncState();
    });
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Manual sync trigger
   */
  async triggerSync(): Promise<void> {
    if (!isOnline()) {
      await waitForOnline();
    }
    await this.sync();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    if (this.webSocket) {
      this.webSocket.close();
    }
  }
}
