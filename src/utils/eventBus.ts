/**
 * Simple event bus for pub/sub pattern
 * Lightweight alternative to Redux/MobX for data events
 */

type EventCallback = (...args: any[]) => void;
type EventMap = Map<string, Set<EventCallback>>;

class EventBus {
  private events: EventMap = new Map();

  /**
   * Subscribe to an event
   */
  on(eventName: string, callback: EventCallback): () => void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }
    this.events.get(eventName)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.off(eventName, callback);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off(eventName: string, callback: EventCallback): void {
    const callbacks = this.events.get(eventName);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.events.delete(eventName);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit(eventName: string, ...args: any[]): void {
    const callbacks = this.events.get(eventName);
    if (callbacks) {
      // Create a copy to avoid issues if callbacks modify the set during iteration
      const callbacksCopy = Array.from(callbacks);
      callbacksCopy.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.events.delete(eventName);
    } else {
      this.events.clear();
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();

