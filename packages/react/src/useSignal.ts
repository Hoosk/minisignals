import { useRef } from 'react';
import { signal, Signal } from '@hoosk/minisignals';

/**
 * Creates a signal that is tied to the component's lifecycle.
 * The signal instance is preserved across re-renders.
 * NOTE: To trigger a re-render on value change, you must use `useSignalValue(sig)`.
 * 
 * @param initialValue The starting value of the signal.
 * @returns A stable Signal instance.
 */
export function useSignal<T>(initialValue: T): Signal<T> {
  const signalRef = useRef<Signal<T> | null>(null);

  if (signalRef.current === null) {
    signalRef.current = signal(initialValue);
  }

  return signalRef.current;
}
