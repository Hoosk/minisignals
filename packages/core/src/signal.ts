import { _activeSubscriber, createDependencySource, DependencySource, scheduleSource, trackDependency } from './effect.js';

export interface ReadonlySignal<T> {
  readonly value: T;
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T;
}

// Class-based implementation so all signal instances share the same prototype
// getter/setter. V8 can monomorphize and inline the accessors instead of
// treating every signal as a unique object with closure-based functions.
class SignalImpl<T> implements Signal<T> {
  /** @internal */ _source: DependencySource;
  /** @internal */ _value: T;

  constructor(initialValue: T) {
    this._source = createDependencySource();
    this._value = initialValue;
  }

  get value(): T {
    // Inline null-check to avoid the trackDependency() function call entirely
    // when there is no active subscriber — the common case outside effects.
    if (_activeSubscriber !== null) trackDependency(this._source);
    return this._value;
  }

  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue;
      scheduleSource(this._source);
    }
  }
}

/**
 * Creates a reactive signal.
 * @param initialValue The starting value.
 * @returns An object with a reactive .value property.
 */
export function signal<T>(initialValue: T): Signal<T> {
  return new SignalImpl(initialValue);
}
