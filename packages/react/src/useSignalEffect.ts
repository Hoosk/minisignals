import { useEffect, useRef } from 'react';
import type { DependencyList } from 'react';
import { effect } from '@hoosk/minisignals';

/**
 * Runs a reactive effect tied to the component's lifecycle.
 *
 * The effect is created on mount, re-created when `deps` change, and stopped
 * on unmount. The callback may return a cleanup function, which runs before
 * each re-execution and when the effect is stopped.
 *
 * @param fn The effect callback. The latest closure is always used.
 * @param deps Optional dependency list that recreates the effect.
 */
export function useSignalEffect(fn: () => void | (() => void), deps: DependencyList = []): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    return effect(() => fnRef.current());
  }, deps);
}
