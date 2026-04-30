// ─── Subscriber flags ───────────────────────────────────────────────────────

export const PENDING     = 1 << 0; // queued in _pendingNotifications
export const RUNNING     = 1 << 1; // effect is currently executing
export const NEEDS_RERUN = 1 << 2; // dependency changed while RUNNING

// ─── Dependency graph types ───────────────────────────────────────────────────

export interface DependencySource {
  subsHead: DependencyLink | null;
  // Points to the link owned by the subscriber currently being tracked.
  // Acts as an O(1) lookup replacing a per-subscriber Map. Saved/restored
  // (rollbackCurrentLink) so nested tracking contexts work correctly.
  currentLink: DependencyLink | null;
}

interface DependencyLink {
  source: DependencySource;
  subscriber: Subscriber;
  trackId: number;
  // Saves the value of source.currentLink that existed before this link was
  // installed, so it can be restored after the tracking pass ends.
  rollbackCurrentLink: DependencyLink | null;
  nextInSource: DependencyLink | null;
  prevInSource: DependencyLink | null;
  nextInSubscriber: DependencyLink | null;
  prevInSubscriber: DependencyLink | null;
}

export interface Subscriber {
  notify: () => void;
  depsHead: DependencyLink | null;
  depsTail: DependencyLink | null;
  trackId: number;
  flags: number;
}

// ActiveEffect uses the same shape — RUNNING and NEEDS_RERUN live in flags.
type ActiveEffect = Subscriber;

let _activeSubscriber: Subscriber | null = null;

// Exported so signal.ts can do an inline null-check in the getter hot path,
// avoiding a function call when there is no active subscriber.
export { _activeSubscriber };

export function createDependencySource(): DependencySource {
  return { subsHead: null, currentLink: null };
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
    // Stable dep: just mark as seen in this run.
    existing.trackId = subscriber.trackId;
    return;
  }

  // New dep: create a link and install it. Save whatever was in currentLink
  // so it can be restored when the tracking pass finishes (rollback chain).
  const link: DependencyLink = {
    source,
    subscriber,
    trackId: subscriber.trackId,
    rollbackCurrentLink: existing,
    nextInSource: source.subsHead,
    prevInSource: null,
    nextInSubscriber: null,
    prevInSubscriber: subscriber.depsTail,
  };

  if (source.subsHead) source.subsHead.prevInSource = link;
  source.subsHead = link;

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
  subscriber.flags &= ~PENDING;
}

// ─── Batch scheduling ────────────────────────────────────────────────────────

let _batchDepth = 0;
const _pendingNotifications: Subscriber[] = [];

function queueSubscriber(subscriber: Subscriber): void {
  if (_batchDepth > 0) {
    if (!(subscriber.flags & PENDING)) {
      subscriber.flags |= PENDING;
      _pendingNotifications.push(subscriber);
    }
  } else {
    subscriber.notify();
  }
}

export function scheduleSource(source: DependencySource): void {
  let link = source.subsHead;
  while (link) {
    const next = link.nextInSource;
    queueSubscriber(link.subscriber);
    link = next;
  }
}

export function batch<T>(fn: () => T): T {
  _batchDepth++;
  try {
    return fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0) {
      const pending = _pendingNotifications.splice(0);
      for (const sub of pending) {
        if (!(sub.flags & PENDING)) continue;
        sub.flags &= ~PENDING;
        sub.notify();
      }
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

/**
 * Creates an effect that runs immediately and tracks dependencies.
 * @param fn The function to execute.
 * @returns An unsubscribe function.
 */
export function effect(fn: () => void): () => void {
  const effectObj = {} as ActiveEffect;

  effectObj.notify = () => {
    if (effectObj.flags & RUNNING) {
      effectObj.flags |= NEEDS_RERUN;
      return;
    }
    effectObj.flags |= RUNNING;
    let iterations = 0;
    try {
      do {
        if (++iterations > MAX_EFFECT_ITERATIONS) {
          throw new Error('Circular dependency detected: effect exceeded maximum re-run limit');
        }
        effectObj.flags &= ~NEEDS_RERUN;
        trackSubscriber(effectObj, fn);
      } while (effectObj.flags & NEEDS_RERUN);
    } finally {
      effectObj.flags &= ~RUNNING;
    }
  };

  effectObj.depsHead = null;
  effectObj.depsTail = null;
  effectObj.trackId = 0;
  effectObj.flags = 0;

  effectObj.notify();

  return () => cleanupSubscriber(effectObj);
}
