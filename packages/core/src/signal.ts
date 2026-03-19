import { activeEffect, SubscriberSet } from './effect';

export interface Signal<T> {
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
      if (activeEffect) {
        subscribers.add(activeEffect.run);
        activeEffect.deps.add(subscribers);
      }
      return _value;
    },
    set value(newValue: T) {
      if (_value !== newValue) {
        _value = newValue;
        [...subscribers].forEach(sub => sub());
      }
    }
  };
}
