import { signal, Signal, ReadonlySignal } from './signal';
import { effect } from './effect';

export interface Computed<T> extends ReadonlySignal<T> {
  /**
   * Stops the internal effect from observing dependencies.
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
  let initialized = false;
  let internalSignal: Signal<T> | null = null;
  let unsubscribe: (() => void) | null = null;
  let isDisposed = false;

  return {
    get value() {
      if (isDisposed) {
        if (!initialized) {
          internalSignal = signal(fn());
          initialized = true;
        }
        return internalSignal!.value;
      }

      if (!initialized) {
        unsubscribe = effect(() => {
          const newValue = fn();
          if (!initialized) {
            internalSignal = signal(newValue);
            initialized = true;
          } else {
            internalSignal!.value = newValue;
          }
        });
      }

      return internalSignal!.value;
    },
    dispose() {
      isDisposed = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    }
  };
}
