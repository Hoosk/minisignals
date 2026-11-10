import { useEffect, useMemo, useRef } from 'react';
import type { DependencyList } from 'react';
import { computed, Computed } from '@hoosk/minisignals';

/**
 * Creates a computed signal tied to the component's lifecycle.
 *
 * The instance is stable across re-renders unless `deps` changes. It is
 * automatically disposed when the component unmounts, preventing the source
 * signals from retaining subscriptions to unmounted components.
 *
 * @param fn The derivation function. The latest closure is always used.
 * @param deps Optional dependency list that recreates the computed instance.
 * @returns A stable Computed instance.
 */
export function useComputed<T>(fn: () => T, deps: DependencyList = []): Computed<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const instance = useMemo(
    () => computed(() => fnRef.current()),
    deps
  );

  useEffect(() => () => instance.dispose(), [instance]);

  return instance;
}
