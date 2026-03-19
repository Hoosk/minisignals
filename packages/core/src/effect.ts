export type SubscriberSet = Set<() => void>;

interface ActiveEffect {
  run: () => void;
  deps: Set<SubscriberSet>;
}

export let activeEffect: ActiveEffect | null = null;

/**
 * Creates an effect that runs immediately and tracks dependencies.
 * @param fn The function to execute.
 * @returns An unsubscribe function.
 */
export function effect(fn: () => void): () => void {
  const effectObj: ActiveEffect = {
    run() {
      cleanup(effectObj);
      const previousEffect = activeEffect;
      activeEffect = effectObj;
      try {
        fn();
      } finally {
        activeEffect = previousEffect;
      }
    },
    deps: new Set<SubscriberSet>()
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
