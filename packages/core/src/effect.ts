// ─── Subscriber flags ───────────────────────────────────────────────────────

export const PENDING     = 1 << 0; // queued in the notification scheduler
export const RUNNING     = 1 << 1; // effect is currently executing
export const NEEDS_RERUN = 1 << 2; // dependency changed while RUNNING
export const DISPOSED    = 1 << 3; // subscriber was cleaned up and must not run again

// ─── Dependency graph types ───────────────────────────────────────────────────

export interface DependencySource {
  subsHead: DependencyLink | null;
  // Points to the link owned by the subscriber currently being tracked.
  // Acts as an O(1) lookup replacing a per-subscriber Map. Saved/restored
  // (rollbackCurrentLink) so nested tracking contexts work correctly.
  currentLink: DependencyLink | null;
  // Incremented only when the source's value actually changes. Effects compare
  // it against the version they last observed to implement early bailout.
  version: number;
  // For computed sources: brings the value up to date if it is dirty. Null for
  // plain signals. Used by effects to "pull" derived values before deciding
  // whether a re-run is necessary.
  refresh: (() => void) | null;
  // Number of computed subscribers. When zero, a signal write cannot produce
  // glitches, so effects can be notified synchronously without queuing.
  computedCount: number;
}

export interface DependencyLink {
  source: DependencySource;
  subscriber: Subscriber;
  trackId: number;
  // Source version observed the last time the subscriber read this dependency.
  seenVersion: number;
  // Saves the value of source.currentLink that existed before this link was
  // installed, so it can be restored after the tracking pass ends.
  rollbackCurrentLink: DependencyLink | null;
  nextInSource: DependencyLink | null;
  prevInSource: DependencyLink | null;
  nextInSubscriber: DependencyLink | null;
  prevInSubscriber: DependencyLink | null;
}

export interface Subscriber {
  // Called once all invalidations in the current pass have been applied.
  notify: () => void;
  // Called during the push phase. Effects queue themselves; computeds mark
  // themselves dirty and keep propagating downstream synchronously.
  invalidate: () => void;
  depsHead: DependencyLink | null;
  depsTail: DependencyLink | null;
  trackId: number;
  flags: number;
  initialized: boolean;
  isComputed: boolean;
  // Intrusive linked queue pointer used by the notification scheduler.
  pendingNext: Subscriber | null;
}

let _activeSubscriber: Subscriber | null = null;

// Exported so signal.ts/computed.ts can do an inline null-check in the getter
// hot path, avoiding a function call when there is no active subscriber.
export { _activeSubscriber };

export function createDependencySource(): DependencySource {
  return { subsHead: null, currentLink: null, version: 0, refresh: null, computedCount: 0 };
}

export function getActiveSubscriber(): Subscriber | null {
  return _activeSubscriber;
}

// ─── Link management ─────────────────────────────────────────────────────────

// Before running a subscriber, stamp each of its existing dep links onto
// source.currentLink (saving whatever was there as rollbackCurrentLink).
// This lets linkDependency find the reusable link with a single pointer read.
function prepareSources(subscriber: Subscriber): void {
  let link = subscriber.depsHead;
  while (link) {
    link.rollbackCurrentLink = link.source.currentLink;
    link.source.currentLink = link;
    link = link.nextInSubscriber;
  }
}

function linkDependency(source: DependencySource, subscriber: Subscriber): void {
  const existing = source.currentLink;
  if (existing !== null && existing.subscriber === subscriber) {
    // Stable dep: mark as seen in this run and record the observed version.
    existing.trackId = subscriber.trackId;
    existing.seenVersion = source.version;
    return;
  }

  // New dep: create a link and install it. Save whatever was in currentLink
  // so it can be restored when the tracking pass finishes (rollback chain).
  const link: DependencyLink = {
    source,
    subscriber,
    trackId: subscriber.trackId,
    seenVersion: source.version,
    rollbackCurrentLink: existing,
    nextInSource: source.subsHead,
    prevInSource: null,
    nextInSubscriber: null,
    prevInSubscriber: subscriber.depsTail,
  };

  if (source.subsHead) source.subsHead.prevInSource = link;
  source.subsHead = link;
  if (subscriber.isComputed) source.computedCount++;

  if (subscriber.depsTail) {
    subscriber.depsTail.nextInSubscriber = link;
  } else {
    subscriber.depsHead = link;
  }
  subscriber.depsTail = link;
  source.currentLink = link;
}

function unlinkDependency(link: DependencyLink): void {
  const { source, subscriber } = link;
  if (subscriber.isComputed) source.computedCount--;

  if (link.prevInSource) {
    link.prevInSource.nextInSource = link.nextInSource;
  } else {
    source.subsHead = link.nextInSource;
  }
  if (link.nextInSource) link.nextInSource.prevInSource = link.prevInSource;

  if (link.prevInSubscriber) {
    link.prevInSubscriber.nextInSubscriber = link.nextInSubscriber;
  } else {
    subscriber.depsHead = link.nextInSubscriber;
  }
  if (link.nextInSubscriber) {
    link.nextInSubscriber.prevInSubscriber = link.prevInSubscriber;
  } else {
    subscriber.depsTail = link.prevInSubscriber;
  }

  link.nextInSource = link.prevInSource = null;
  link.nextInSubscriber = link.prevInSubscriber = null;
}

// After the fn runs: prune stale links and restore source.currentLink for all
// links we touched (both kept and removed) so outer contexts are unaffected.
function pruneStaleDependencies(subscriber: Subscriber): void {
  let link = subscriber.depsHead;
  while (link) {
    const next = link.nextInSubscriber;
    // Restore regardless of whether we keep or prune the link.
    link.source.currentLink = link.rollbackCurrentLink;
    link.rollbackCurrentLink = null;
    if (link.trackId !== subscriber.trackId) unlinkDependency(link);
    link = next;
  }
}

export function trackDependency(source: DependencySource): void {
  if (_activeSubscriber) linkDependency(source, _activeSubscriber);
}

export function trackSubscriber<T>(subscriber: Subscriber, fn: () => T): T {
  const previous = _activeSubscriber;
  subscriber.trackId++;
  prepareSources(subscriber);
  _activeSubscriber = subscriber;
  try {
    return fn();
  } finally {
    _activeSubscriber = previous;
    pruneStaleDependencies(subscriber);
  }
}

export function cleanupSubscriber(subscriber: Subscriber): void {
  let link = subscriber.depsHead;
  while (link) {
    const next = link.nextInSubscriber;
    // Restore currentLink if it still points to this link.
    if (link.source.currentLink === link) {
      link.source.currentLink = link.rollbackCurrentLink;
    }
    link.rollbackCurrentLink = null;
    unlinkDependency(link);
    link = next;
  }
  subscriber.depsHead = null;
  subscriber.depsTail = null;
  subscriber.flags = DISPOSED;
}

// ─── Push phase ──────────────────────────────────────────────────────────────

// Walks the subscriber list and lets each node decide how to invalidate:
// computeds mark themselves dirty and keep propagating synchronously, while
// effects only queue themselves. No effect runs during this phase, which is
// what makes diamond graphs glitch-free.
export function invalidateSource(source: DependencySource): void {
  let link = source.subsHead;
  while (link) {
    const next = link.nextInSource;
    link.subscriber.invalidate();
    link = next;
  }
}

// ─── Pull phase / scheduling ─────────────────────────────────────────────────

let _batchDepth = 0;
let _flushDepth = 0;
let _pendingHead: Subscriber | null = null;
let _pendingTail: Subscriber | null = null;

function enqueueSubscriber(subscriber: Subscriber): void {
  subscriber.flags |= PENDING;
  subscriber.pendingNext = null;
  if (_pendingTail === null) {
    _pendingHead = subscriber;
  } else {
    _pendingTail.pendingNext = subscriber;
  }
  _pendingTail = subscriber;
}

function clearPendingQueue(): void {
  let subscriber = _pendingHead;
  while (subscriber !== null) {
    const next = subscriber.pendingNext;
    subscriber.flags &= ~PENDING;
    subscriber.pendingNext = null;
    subscriber = next;
  }
  _pendingHead = null;
  _pendingTail = null;
}

function flushPendingNotifications(): void {
  if (_flushDepth > 0) return;
  _flushDepth++;
  let failed = false;
  try {
    while (_pendingHead !== null) {
      const subscriber = _pendingHead;
      _pendingHead = subscriber.pendingNext;
      subscriber.pendingNext = null;
      if (_pendingHead === null) _pendingTail = null;
      if (!(subscriber.flags & PENDING)) continue;
      subscriber.flags &= ~PENDING;
      subscriber.notify();
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    // On failure, do not leave subscribers permanently stuck with PENDING set.
    if (failed) clearPendingQueue();
    _flushDepth--;
  }
}

// Every signal write is an implicit batch: versions are bumped, invalidations
// are pushed through the whole graph, and only then are effects notified.
export function scheduleSource(source: DependencySource): void {
  source.version++;

  if (_batchDepth !== 0) {
    invalidateSource(source);
    return;
  }

  // Fast path: without computed subscribers there is no derived state that
  // could be observed mid-write, so effects can run right away (glitches are
  // impossible).
  if (source.computedCount === 0) {
    let link = source.subsHead;
    while (link) {
      const next = link.nextInSource;
      link.subscriber.notify();
      link = next;
    }
    return;
  }

  _batchDepth = 1;
  try {
    invalidateSource(source);
  } finally {
    _batchDepth = 0;
    if (_pendingHead !== null) flushPendingNotifications();
  }
}

export function batch<T>(fn: () => T): T {
  _batchDepth++;
  try {
    return fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0 && _pendingHead !== null) {
      flushPendingNotifications();
    }
  }
}

// ─── Untracked read ───────────────────────────────────────────────────────────

export function untracked<T>(fn: () => T): T {
  const previous = _activeSubscriber;
  _activeSubscriber = null;
  try {
    return fn();
  } finally {
    _activeSubscriber = previous;
  }
}

// ─── Effect ──────────────────────────────────────────────────────────────────

const MAX_EFFECT_ITERATIONS = 100;

function dependenciesChanged(subscriber: Subscriber): boolean {
  if (!subscriber.initialized) return true;
  let link = subscriber.depsHead;
  while (link) {
    const source = link.source;
    // Pull derived values before comparing: a dirty computed may still end up
    // producing the same value, which lets us skip the re-run entirely.
    if (source.refresh !== null) source.refresh();
    if (source.version !== link.seenVersion) return true;
    link = link.nextInSubscriber;
  }
  return false;
}

/**
 * Creates an effect that runs immediately and tracks dependencies.
 *
 * The callback may return a cleanup function. It is invoked before every
 * re-run and when the effect is stopped.
 *
 * @param fn The function to execute.
 * @returns An unsubscribe function.
 */
export function effect(fn: () => void | (() => void)): () => void {
  const instance = new EffectImpl(fn);
  instance.notify();
  return () => instance.stop();
}

// Class-based so every effect shares the same hidden class and prototype
// methods. This keeps subscription lists monomorphic for V8 and avoids
// allocating a pair of closures per effect instance.
class EffectImpl implements Subscriber {
  depsHead: DependencyLink | null = null;
  depsTail: DependencyLink | null = null;
  trackId = 0;
  flags = 0;
  initialized = false;
  isComputed = false;
  pendingNext: Subscriber | null = null;

  private _fn: () => void | (() => void);
  private _cleanup: (() => void) | null = null;

  constructor(fn: () => void | (() => void)) {
    this._fn = fn;
  }

  notify(): void {
    if (this.flags & DISPOSED) return;
    if (this.flags & RUNNING) {
      this.flags |= NEEDS_RERUN;
      return;
    }
    if (!dependenciesChanged(this)) return;
    this._run();
  }

  invalidate(): void {
    if (this.flags & DISPOSED) return;
    if (_batchDepth !== 0) {
      if (!(this.flags & PENDING)) enqueueSubscriber(this);
    } else {
      this.notify();
    }
  }

  stop(): void {
    if (this.flags & DISPOSED) return;
    try {
      if (this._cleanup !== null) {
        const previousCleanup = this._cleanup;
        this._cleanup = null;
        previousCleanup();
      }
    } finally {
      cleanupSubscriber(this);
    }
  }

  private _run(): void {
    this.flags |= RUNNING;
    let iterations = 0;
    try {
      do {
        if (++iterations > MAX_EFFECT_ITERATIONS) {
          throw new Error('Circular dependency detected: effect exceeded maximum re-run limit');
        }
        this.flags &= ~NEEDS_RERUN;

        if (this._cleanup !== null) {
          const previousCleanup = this._cleanup;
          this._cleanup = null;
          previousCleanup();
        }

        const result = trackSubscriber(this, this._fn);
        this._cleanup = typeof result === 'function' ? result : null;
        this.initialized = true;

        if (this.flags & DISPOSED) {
          if (this._cleanup !== null) {
            const finalCleanup = this._cleanup;
            this._cleanup = null;
            finalCleanup();
          }
          // Dependencies read after stop() was called during this run were
          // linked again; remove them so a disposed effect holds no references.
          cleanupSubscriber(this);
          break;
        }
      } while (this.flags & NEEDS_RERUN);
    } finally {
      this.flags &= ~RUNNING;
    }
  }
}
