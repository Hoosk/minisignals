import { customRef, getCurrentScope, onScopeDispose } from 'vue';
import type { Ref } from 'vue';
import { effect } from '@hoosk/minisignals';
import type { Signal } from '@hoosk/minisignals';

/**
 * Registers a cleanup callback when the composable is used inside a Vue
 * component setup or an effectScope. Outside a scope there is nothing to tie
 * the subscription to, so the caller owns the lifecycle.
 */
export function disposeOnScope(stop: () => void): void {
  if (getCurrentScope()) onScopeDispose(stop);
}

/**
 * Bridges a Signal to a writable Vue Ref. The returned ref auto-unwraps in
 * templates and works directly with `v-model`.
 */
export function signalToRef<T>(sig: Signal<T>): Ref<T> {
  return customRef<T>((track, trigger) => {
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
      set(value: T) {
        sig.value = value;
      },
    };
  });
}
