import { signal, Signal } from './signal';
import { effect } from './effect';

export interface Computed<T> {
  readonly value: T;
  /**
   * Stops the internal effect.
   * Call this when the computed signal is no longer needed.
   */
  dispose: () => void;
}

/**
 * Creates a computed signal it caches the result and
 * only updates when its dependencies change.
 * @param fn The function to compute the value.
 * @returns A read-only signal with a dispose method.
 */
export function computed<T>(fn: () => T): Computed<T> {
  let initialized = false;
  let internalSignal!: Signal<T>;

  const unsubscribe = effect(() => {
    const newValue = fn();
    if (!initialized) {
      internalSignal = signal(newValue);
      initialized = true;
    } else {
      internalSignal.value = newValue;
    }
  });

  return {
    get value() {
      return internalSignal.value;
    },
    dispose() {
      unsubscribe();
    }
  };
}
