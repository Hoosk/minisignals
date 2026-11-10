import { _activeSubscriber, createDependencySource, DependencySource, scheduleSource, trackDependency } from './effect.js';

export interface ReadonlySignal<T> {
  readonly value: T;
  /**
   * Reads the current value without subscribing the active effect/computed.
   * Unlike `untracked(() => sig.value)` this avoids allocating a closure.
   */
  peek(): T;
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
      // Writes with no subscribers are a pure property assignment: skip the
      // scheduling machinery entirely.
      if (this._source.subsHead !== null) scheduleSource(this._source);
    }
  }

  peek(): T {
    return this._value;
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
