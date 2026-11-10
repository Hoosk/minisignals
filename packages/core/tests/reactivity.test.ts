import { describe, it, expect, vi } from 'vitest';
import { signal, effect, computed, batch } from '../src/index.ts';

describe('@hoosk/minisignals - glitch-free reactivity', () => {
  it('should mark every computed dirty before running effects (diamond graph)', () => {
    const a = signal(1);
    const b = computed(() => a.value * 2);
    const c = computed(() => a.value * 3);
    let result = 0;

    const spy = vi.fn(() => {
      result = b.value + c.value;
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toBe(5);

    a.value = 2;

    // Exactly one re-run, observing a consistent pair of values.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toBe(10);
  });

  it('should not expose stale computed values inside batch()', () => {
    const a = signal(1);
    const double = computed(() => a.value * 2);

    expect(double.value).toBe(2);

    batch(() => {
      a.value = 5;
      // Must be fresh even though notifications are deferred.
      expect(double.value).toBe(10);
    });

    expect(double.value).toBe(10);
  });

  it('should only run an effect once when multiple computed deps change in a batch', () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => a.value + 2);
    const spy = vi.fn(() => {
      b.value;
      c.value;
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    batch(() => {
      a.value = 2;
      a.value = 3;
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('@hoosk/minisignals - computed early bailout', () => {
  it('should not re-run downstream effects when the derived value is unchanged', () => {
    const a = signal(1);
    const isEven = computed(() => a.value % 2 === 0);
    const spy = vi.fn(() => {
      isEven.value;
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    a.value = 3; // still odd — derived value does not change
    expect(spy).toHaveBeenCalledTimes(1);

    a.value = 4; // now even — derived value changes
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should bail out through chains of computed signals', () => {
    const a = signal(1);
    const parity = computed(() => a.value % 2);
    const label = computed(() => (parity.value === 0 ? 'even' : 'odd'));
    const spy = vi.fn(() => {
      label.value;
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    a.value = 5;
    expect(spy).toHaveBeenCalledTimes(1);

    a.value = 6;
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('@hoosk/minisignals - batch error safety', () => {
  it('should not leave subscribers stuck with PENDING when an effect throws', () => {
    const a = signal(0);
    const b = signal(0);

    const bad = vi.fn(() => {
      if (a.value === 1) throw new Error('boom');
    });
    const good = vi.fn(() => {
      b.value;
    });

    effect(() => bad(a.value));
    effect(() => good());

    expect(good).toHaveBeenCalledTimes(1);

    expect(() => {
      batch(() => {
        a.value = 1;
        b.value = 1;
      });
    }).toThrow('boom');

    // The throwing effect prevented the good one from running in that flush,
    // but its PENDING flag must have been cleared.
    expect(good).toHaveBeenCalledTimes(1);

    b.value = 2;
    expect(good).toHaveBeenCalledTimes(2);
  });
});

describe('@hoosk/minisignals - peek()', () => {
  it('signal.peek() should read without subscribing', () => {
    const a = signal(1);
    const spy = vi.fn(() => {
      a.peek();
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    a.value = 2;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(a.peek()).toBe(2);
  });

  it('computed.peek() should refresh without subscribing the outer effect', () => {
    const a = signal(1);
    const double = computed(() => a.value * 2);
    const spy = vi.fn(() => {
      double.peek();
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    a.value = 2;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(double.peek()).toBe(4);
  });

  it('peek() should not track inside computed evaluation', () => {
    const tracked = signal(1);
    const ignored = signal(10);
    const derived = computed(() => tracked.value + ignored.peek());
    const spy = vi.fn(() => {
      derived.value;
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(derived.value).toBe(11);

    ignored.value = 20; // peek'd — must not invalidate the computed
    expect(spy).toHaveBeenCalledTimes(1);
    expect(derived.value).toBe(11);

    tracked.value = 2;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(derived.value).toBe(22);
  });
});

describe('@hoosk/minisignals - effect() cleanup and disposal', () => {
  it('should run the returned cleanup before every re-run and on stop', () => {
    const a = signal(0);
    const cleanup = vi.fn();
    const spy = vi.fn(() => {
      a.value;
      return cleanup;
    });

    const stop = effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(0);

    a.value = 1;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);

    stop();
    expect(cleanup).toHaveBeenCalledTimes(2);

    a.value = 2;
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should stop immediately when disposed from inside its own run', () => {
    const sig = signal(0);
    let runs = 0;
    let stop: (() => void) | null = null;

    stop = effect(() => {
      runs++;
      if (sig.value === 1) stop!();
    });

    sig.value = 1;
    expect(runs).toBe(2);

    sig.value = 2;
    expect(runs).toBe(2);
  });

  it('should not re-run a disposed effect queued during a batch', () => {
    const a = signal(0);
    const spy = vi.fn(() => {
      a.value;
    });

    const stop = effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    batch(() => {
      a.value = 1;
      stop();
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
