import { customRef } from 'vue';
import type { Ref } from 'vue';
import { effect } from '@hoosk/minisignals';
import type { ReadonlySignal } from '@hoosk/minisignals';
import { disposeOnScope } from './bridge';

/**
 * Subscribes to a Signal or Computed and exposes its value as a read-only Vue
 * Ref. The subscription is torn down automatically when the component (or
 * effectScope) is disposed.
 *
 * @param sig Any ReadonlySignal (Signal or Computed) to observe.
 * @returns A read-only Ref that updates with the signal.
 */
export function useSignalValue<T>(sig: ReadonlySignal<T>): Readonly<Ref<T>> {
  const ref = customRef<T>((track, trigger) => {
    const stop = effect(() => {
      sig.value;
      trigger();
    });
    disposeOnScope(stop);

    return {
      get() {
        track();
        return sig.value;
      },
      set() {
        // read-only
      },
    };
  });

  return ref as Readonly<Ref<T>>;
}
