/**
 * Main App component with routing
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { OrderEntry } from "../components/orders/OrderEntry";

// Lazy load screens for code splitting
const KitchenDisplay = lazy(() =>
  import("../components/kitchen/KitchenDisplay").then((m) => ({
    default: m.KitchenDisplay,
  }))
);
const PrintSettings = lazy(() =>
  import("../components/print/PrintSettings").then((m) => ({
    default: m.PrintSettings,
  }))
);
import { getDataStore } from "../data/OfflineDataStore";
import { SyncEngine } from "../domain/sync/SyncEngine";
import { getCatalogService } from "../domain/catalog/CatalogService";
import { initSampleData } from "../utils/initSampleData";
import { CartProvider } from "../contexts/CartContext";
import "../utils/inspectDB"; // Make DB inspection utilities available in console
import type { Route } from "./routes";

// Initialize sync engine (in production, this would come from config)
const syncEngine = new SyncEngine({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  syncInterval: 30000, // 30 seconds
  enableWebSocket: false, // Set to true when WebSocket is available
});

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>("order-entry");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Register service worker
        if ("serviceWorker" in navigator) {
          try {
            const registration = await navigator.serviceWorker.register(
              "/sw.js"
            );
            console.log("Service Worker registered:", registration);
          } catch (error) {
            console.warn("Service Worker registration failed:", error);
          }
        }

        // Initialize data store
        const dataStore = getDataStore();
        await dataStore.init();

        // Initialize catalog
        const catalogService = getCatalogService();
        await catalogService.initialize();

        // Initialize sample data (only in development)
        if (import.meta.env.DEV) {
          await initSampleData();
          // Re-initialize catalog after sample data
          await catalogService.initialize();
        }

        console.log("apiBaseUrl -->>", import.meta.env.VITE_API_BASE_URL);
        // Initialize sync engine
        await syncEngine.initialize();

        setInitialized(true);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        // Still show UI even if initialization fails
        setInitialized(true);
      }
    };

    initialize();

    return () => {
      syncEngine.destroy();
    };
  }, []);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Initializing...</div>
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="h-screen flex flex-col">
        {/* Navigation */}
        <nav className="bg-gray-800 text-white p-2 flex gap-1 md:gap-2 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setCurrentRoute("order-entry")}
            className={`px-3 md:px-4 py-2 rounded text-sm md:text-base whitespace-nowrap ${
              currentRoute === "order-entry"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            Order Entry
          </button>
          <button
            onClick={() => setCurrentRoute("kitchen")}
            className={`px-3 md:px-4 py-2 rounded text-sm md:text-base whitespace-nowrap ${
              currentRoute === "kitchen"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            Kitchen
          </button>
          <button
            onClick={() => setCurrentRoute("print-settings")}
            className={`px-3 md:px-4 py-2 rounded text-sm md:text-base whitespace-nowrap ${
              currentRoute === "print-settings"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            Print Queue
          </button>
        </nav>

        {/* Route Content */}
        <main className="flex-1 overflow-hidden">
          {currentRoute === "order-entry" && <OrderEntry />}
          {currentRoute === "kitchen" && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-screen">
                  Loading...
                </div>
              }
            >
              <KitchenDisplay />
            </Suspense>
          )}
          {currentRoute === "print-settings" && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-screen">
                  Loading...
                </div>
              }
            >
              <PrintSettings />
            </Suspense>
          )}
        </main>
      </div>
    </CartProvider>
  );
}

export default App;
