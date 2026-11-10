import { signal } from '@hoosk/minisignals';
import type { Signal } from '@hoosk/minisignals';
import type { Ref } from 'vue';
import { signalToRef } from './bridge';

/**
 * Creates a local signal and exposes it as a writable Vue Ref. The ref can be
 * used directly in templates (auto-unwrapping) and with `v-model`.
 *
 * @param initialValue The starting value of the signal.
 * @returns A writable Ref backed by a stable Signal.
 */
export function useSignal<T>(initialValue: T): Ref<T> {
  return useSignalRef(signal(initialValue));
}

/**
 * Bridges an existing Signal to a writable Vue Ref.
 */
export function useSignalRef<T>(sig: Signal<T>): Ref<T> {
  return signalToRef(sig);
}
