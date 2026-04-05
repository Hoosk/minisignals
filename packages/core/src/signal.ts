import { getActiveEffect, scheduleSubs, SubscriberSet } from './effect';

export interface ReadonlySignal<T> {
  readonly value: T;
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T;
}

/**
 * Creates a reactive signal.
 * @param initialValue The starting value.
 * @returns An object with a reactive .value property.
 */
export function signal<T>(initialValue: T): Signal<T> {
  const subscribers: SubscriberSet = new Set();
  let _value = initialValue;

  return {
    get value() {
      const active = getActiveEffect();
      if (active) {
        subscribers.add(active.run);
        active.deps.add(subscribers);
      }
      return _value;
    },
    set value(newValue: T) {
      if (_value !== newValue) {
        _value = newValue;
        scheduleSubs(subscribers);
      }
    }
  };
}
