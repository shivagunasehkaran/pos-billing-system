# POS System - Offline-First Architecture

A production-ready Point of Sale (POS) system built with React, TypeScript, and Tailwind CSS. Designed for offline-first operation with multi-device coordination, print queue management, and real-time synchronization.

## Features

- ✅ **Offline-First Architecture** - Full functionality without internet connection
- ✅ **Multi-Device Support** - Cashier, kitchen, and printer coordination
- ✅ **Real-Time Sync** - Automatic synchronization when online
- ✅ **Print Queue Management** - Priority-based print job queue with retry logic
- ✅ **Conflict Resolution** - Smart conflict handling for concurrent edits
- ✅ **Touch-Friendly UI** - Optimized for tablet devices
- ✅ **Small Bundle Size** - Minimal dependencies, optimized for performance

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS (with JIT and purge)
- **State Management**: Custom hooks + Context + Event Bus
- **Storage**: IndexedDB (wrapped in OfflineDataStore)
- **Offline Support**: Service Worker for app shell caching
- **Build Tool**: Vite

## Architecture Overview

### 4-Layer Architecture

1. **UI / Presentation Layer**
   - React components with Tailwind CSS
   - Screens: Order Entry, Kitchen Display, Print Settings
   - Responsive to events from data layer

2. **Application / Domain Layer**
   - `OrderService` - Order creation, status management
   - `CatalogService` - Product catalog, search, filtering
   - `InventoryService` - Stock management, reservations
   - `PrintJobManager` - Print queue, priorities, retries
   - `SyncEngine` - Local/server sync coordination

3. **Data Layer (OfflineDataStore)**
   - Read-through cache (memory → IndexedDB)
   - Write queue / outbox for offline operations
   - Transaction support with rollback
   - Event emission for UI updates

4. **Sync & Integration Layer**
   - `SyncEngine` - Pushes local changes, pulls server updates
   - WebSocket support for real-time updates (optional)
   - Conflict resolution with versioning

## Project Structure

```
src/
  app/
    App.tsx              # Main app with routing
    routes.tsx           # Route configuration
  components/
    orders/              # Order-related components
    catalog/             # Product catalog components
    cart/                # Shopping cart components
    kitchen/              # Kitchen display components
    print/                # Print queue components
    common/               # Shared components
  domain/
    orders/              # Order domain logic
    catalog/             # Catalog domain logic
    inventory/            # Inventory domain logic
    print/                # Print job management
    sync/                 # Synchronization engine
    types.ts              # Shared domain types
  data/
    OfflineDataStore.ts  # IndexedDB wrapper
    dbConfig.ts          # Database schema
  hooks/
    useCart.ts           # Shopping cart hook
    useOrders.ts         # Orders management hook
    useCatalog.ts        # Catalog hook
    useSyncStatus.ts     # Sync status hook
  utils/
    eventBus.ts          # Pub/sub event system
    logger.ts            # Logging utility
    network.ts           # Network utilities
    initSampleData.ts    # Sample data for dev
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Sample Data

Sample products and inventory are automatically initialized in development mode. You can customize this in `src/utils/initSampleData.ts`.

## Key Concepts

### Offline-First Data Flow

1. **Local Writes**: All writes go to IndexedDB + outbox immediately
2. **Sync Queue**: Operations are queued in outbox when offline
3. **Auto Sync**: When online, SyncEngine pushes queued operations
4. **Conflict Resolution**: Server version wins if newer, otherwise local changes are preserved

### Order Status Flow

```
pending → preparing → ready → completed
```

Status transitions are enforced (no downgrades). Conflict resolution uses status ordering.

### Print Queue

- Jobs are stored in IndexedDB
- Processed by priority (kitchen > bar > receipt)
- Automatic retry with exponential backoff
- Supports local print bridge or browser print (fallback)

### Multi-Device Coordination

- All devices connect to same backend/WebSocket channel
- Real-time order status updates via WebSocket
- Fallback to polling if WebSocket unavailable
- Device pairing via backend (no local discovery needed)

## Configuration

### Sync Engine

Configure in `src/app/App.tsx`:

```typescript
const syncEngine = new SyncEngine({
  apiBaseUrl: 'http://localhost:3000/api',
  syncInterval: 30000, // 30 seconds
  enableWebSocket: false,
  webSocketUrl: 'ws://localhost:3000',
});
```

### Environment Variables

Create `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Data Pruning

The system automatically prunes old data:

- Completed orders older than 7-30 days (configurable)
- Successful print jobs older than 1 day
- Old sync logs

## Performance Optimizations

- **Memory Caching**: Hot data kept in memory (bounded size)
- **Virtualized Lists**: For large product catalogs (1000+ items)
- **Code Splitting**: Main POS screen as initial chunk
- **Tailwind Purge**: Only used CSS classes included
- **Tree Shaking**: Unused code eliminated

## Browser Support

- Modern browsers with IndexedDB support
- Service Worker support for offline functionality
- Touch-friendly for tablet devices

## License

MIT
