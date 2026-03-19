import { signal, Signal } from './signal.ts';
import { effect } from './effect.ts';

export interface Computed<T> {
  readonly value: T;
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
  let internalSignal!: Signal<T>;
  let unsubscribe: (() => void) | null = null;
  let isDisposed = false;

  return {
    get value() {
      if (isDisposed) {
        if (!initialized) return fn();
        return internalSignal.value;
      }

      if (!initialized) {
        unsubscribe = effect(() => {
          const newValue = fn();
          if (!initialized) {
            internalSignal = signal(newValue);
            initialized = true;
          } else {
            internalSignal.value = newValue;
          }
        });
      }

      return internalSignal.value;
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
