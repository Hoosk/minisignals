export type SubscriberSet = Set<() => void>;

interface ActiveEffect {
  run: () => void;
  deps: Set<SubscriberSet>;
  isRunning: boolean;
}

let _activeEffect: ActiveEffect | null = null;

export function getActiveEffect(): ActiveEffect | null {
  return _activeEffect;
}

// --- Batch scheduling ---

let _batchDepth = 0;
const _pendingNotifications = new Set<() => void>();

export function scheduleSubs(subscribers: SubscriberSet): void {
  if (_batchDepth > 0) {
    for (const sub of subscribers) {
      _pendingNotifications.add(sub);
    }
  } else {
    for (const sub of [...subscribers]) {
      sub();
    }
  }
}

export function batch<T>(fn: () => T): T {
  _batchDepth++;
  try {
    return fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0) {
      const pending = [..._pendingNotifications];
      _pendingNotifications.clear();
      for (const sub of pending) {
        sub();
      }
    }
  }
}

// --- Untracked read ---

export function untracked<T>(fn: () => T): T {
  const previous = _activeEffect;
  _activeEffect = null;
  try {
    return fn();
  } finally {
    _activeEffect = previous;
  }
}

// --- Effect ---

/**
 * Creates an effect that runs immediately and tracks dependencies.
 * @param fn The function to execute.
 * @returns An unsubscribe function.
 */
export function effect(fn: () => void): () => void {
  const effectObj: ActiveEffect = {
    run() {
      if (effectObj.isRunning) return;
      cleanup(effectObj);
      const previousEffect = _activeEffect;
      _activeEffect = effectObj;
      effectObj.isRunning = true;
      try {
        fn();
      } finally {
        effectObj.isRunning = false;
        _activeEffect = previousEffect;
      }
    },
    deps: new Set<SubscriberSet>(),
    isRunning: false,
  };

  function cleanup(eff: ActiveEffect) {
    for (const depSet of eff.deps) {
      depSet.delete(eff.run);
    }
    eff.deps.clear();
  }

  effectObj.run();

  return () => cleanup(effectObj);
}
