import { effect } from '@hoosk/minisignals';
import { disposeOnScope } from './bridge';

/**
 * Runs a reactive effect tied to the component's lifecycle.
 *
 * The effect is stopped automatically when the component (or effectScope) is
 * disposed. The callback may return a cleanup function, which runs before each
 * re-execution and when the effect is stopped.
 *
 * @param fn The effect callback.
 * @returns A stop function for manual teardown.
 */
export function useSignalEffect(fn: () => void | (() => void)): () => void {
  const stop = effect(fn);
  disposeOnScope(stop);
  return stop;
}
