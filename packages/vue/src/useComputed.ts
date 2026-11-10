import { computed as coreComputed } from '@hoosk/minisignals';
import type { Ref } from 'vue';
import { useSignalValue } from './useSignalValue';
import { disposeOnScope } from './bridge';

/**
 * Creates a computed signal derived from other signals and exposes it as a
 * read-only Vue Ref.
 *
 * The computed instance is disposed automatically when the component or
 * effectScope is torn down, preventing source signals from retaining
 * subscriptions to unmounted components.
 *
 * @param fn The derivation function.
 * @returns A read-only Ref that updates when dependencies change.
 */
export function useComputed<T>(fn: () => T): Readonly<Ref<T>> {
  const derived = coreComputed(fn);
  disposeOnScope(() => derived.dispose());
  return useSignalValue(derived);
}
