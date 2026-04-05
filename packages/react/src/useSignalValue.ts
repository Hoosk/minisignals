import { useSyncExternalStore, useCallback } from 'react';
import { effect, ReadonlySignal } from '@hoosk/minisignals';

/**
 * A hook that subscribes to a signal or computed value and triggers
 * a React re-render whenever the value changes.
 * Uses React 18's useSyncExternalStore for tear-free concurrent rendering.
 *
 * @param sig Any ReadonlySignal (Signal or Computed) to observe.
 * @returns The current value of the signal.
 */
export function useSignalValue<T>(sig: ReadonlySignal<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isInitialRun = true;

      const unsubscribe = effect(() => {
        const _val = sig.value;

        if (!isInitialRun) {
          onStoreChange();
        }
        isInitialRun = false;
      });

      return unsubscribe;
    },
    [sig]
  );

  return useSyncExternalStore(
    subscribe,
    () => sig.value, // getSnapshot
    () => sig.value  // getServerSnapshot (SSR support)
  );
}
