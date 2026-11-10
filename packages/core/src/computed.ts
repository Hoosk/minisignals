import {
  _activeSubscriber,
  cleanupSubscriber,
  createDependencySource,
  DependencyLink,
  DependencySource,
  invalidateSource,
  Subscriber,
  trackDependency,
  trackSubscriber,
  untracked,
} from './effect.js';
import type { ReadonlySignal } from './signal.js';

export interface Computed<T> extends ReadonlySignal<T> {
  /**
   * Stops the computed signal from observing dependencies.
   * Call this when the computed signal is no longer needed to prevent memory leaks.
   */
  dispose: () => void;
}

// Same rationale as SignalImpl: a single prototype keeps V8 happy and lets the
// getter inline the active-subscriber null check on the hot read path.
// Implementing Subscriber directly avoids allocating a separate observer node.
class ComputedImpl<T> implements Computed<T>, Subscriber {
  /** @internal */ _source: DependencySource;
  depsHead: DependencyLink | null = null;
  depsTail: DependencyLink | null = null;
  trackId = 0;
  flags = 0;
  initialized = false;
  isComputed = true;
  pendingNext: Subscriber | null = null;

  private _fn: () => T;
  private _cachedValue!: T;
  private _dirty = true;
  private _disposed = false;

  constructor(fn: () => T) {
    this._fn = fn;

    const source = createDependencySource();
    this._source = source;

    source.refresh = () => {
      if (!this._disposed && (!this.initialized || this._dirty)) {
        this._refresh();
      }
    };
  }

  notify(): void {}

  invalidate(): void {
    if (this._disposed || this._dirty) return;
    this._dirty = true;
    // Keep pushing downstream immediately so every computed in the graph
    // is invalidated before any effect runs (glitch-free diamonds).
    // Skip the walk entirely when nobody observes this computed.
    if (this._source.subsHead !== null) invalidateSource(this._source);
  }

  get value(): T {
    if (this._disposed) {
      if (!this.initialized) {
        // Freeze the first read after disposal without subscribing to the
        // signals read inside fn.
        this._cachedValue = untracked(this._fn);
        this.initialized = true;
        this._dirty = false;
      }
      if (_activeSubscriber !== null) trackDependency(this._source);
      return this._cachedValue;
    }

    if (!this.initialized || this._dirty) this._refresh();
    if (_activeSubscriber !== null) trackDependency(this._source);
    return this._cachedValue;
  }

  peek(): T {
    return untracked(() => this.value);
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._dirty = false;
    cleanupSubscriber(this);
  }

  private _refresh(): void {
    const previousValue = this._cachedValue;
    const wasInitialized = this.initialized;

    this._cachedValue = trackSubscriber(this, this._fn);
    this.initialized = true;
    this._dirty = false;

    // Early bailout: equal derived values do not advance the version, so
    // downstream subscribers can detect that nothing actually changed.
    if (!wasInitialized || this._cachedValue !== previousValue) {
      this._source.version++;
    }
  }
}

/**
 * Creates a computed signal that derives its value from other signals.
 * It only calculates and subscribes when its value is read for the first time.
 *
 * @param fn The function to compute the value.
 * @returns A read-only signal with a dispose method.
 */
export function computed<T>(fn: () => T): Computed<T> {
  return new ComputedImpl(fn);
}
