import {
  cleanupSubscriber,
  createDependencySource,
  getActiveSubscriber,
  scheduleSource,
  Subscriber,
  trackDependency,
  trackSubscriber,
} from './effect.js';
import { ReadonlySignal } from './signal.js';

export interface Computed<T> extends ReadonlySignal<T> {
  /**
   * Stops the computed signal from observing dependencies.
   * Call this when the computed signal is no longer needed to prevent memory leaks.
   */
  dispose: () => void;
}

/**
 * Creates a computed signal that derives its value from other signals.
 * It only calculates and subscribes when its value is read for the first time.
 *
 * @param fn The function to compute the value.
 * @returns A read-only signal with a dispose method.
 */
export function computed<T>(fn: () => T): Computed<T> {
  const source = createDependencySource();
  const observer: Subscriber = {
    notify() {
      if (isDisposed || dirty) return;
      dirty = true;
      scheduleSource(source);
    },
    depsHead: null,
    depsTail: null,
    trackId: 0,
    pending: false,
  };

  let initialized = false;
  let isDisposed = false;
  let dirty = true;
  let cachedValue!: T;

  function refreshValue(): void {
    // Clear pending so a batch flush after an eager read inside the same batch
    // does not re-trigger notify() on an already-fresh computed.
    // We do NOT call cleanupSubscriber here: trackSubscriber increments trackId
    // and pruneStaleDependencies removes only stale links, reusing stable ones.
    observer.pending = false;
    cachedValue = trackSubscriber(observer, fn);
    initialized = true;
    dirty = false;
  }

  return {
    get value() {
      if (getActiveSubscriber()) trackDependency(source);

      if (isDisposed) {
        if (!initialized) {
          cachedValue = fn();
          initialized = true;
          dirty = false;
        }
        return cachedValue;
      }

      if (!initialized || dirty) refreshValue();

      return cachedValue;
    },
    dispose() {
      isDisposed = true;
      dirty = false;
      cleanupSubscriber(observer);
    },
  };
}
