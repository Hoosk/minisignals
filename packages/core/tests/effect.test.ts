import { describe, it, expect, vi } from 'vitest';
import { signal, effect, untracked } from '../src/index.ts';

describe('@hoosk/minisignals - effect()', () => {
  it('should run immediately upon creation', () => {
    const spy = vi.fn();
    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should subscribe to signals and re-run on changes', () => {
    const count = signal(0);
    const spy = vi.fn(() => {
      const val = count.value; // subscribe
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    count.value = 1;
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('NEGATIVE CASE: should NOT re-run if the signal value is set to the same value', () => {
    const count = signal(10);
    const spy = vi.fn(() => {
      const val = count.value;
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Setting exact same primitive value
    count.value = 10;
    expect(spy).toHaveBeenCalledTimes(1); // Should still be 1
  });

  it('should handle dynamic dependencies correctly (dynamic unsubscribing)', () => {
    const showCount = signal(true);
    const count = signal(0);
    
    const spy = vi.fn(() => {
      if (showCount.value) {
        return count.value;
      }
      return 'hidden';
    });

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1); // Run 1

    count.value = 1;
    expect(spy).toHaveBeenCalledTimes(2); // Run 2 (tracked count)

    showCount.value = false;
    expect(spy).toHaveBeenCalledTimes(3); // Run 3 (tracked showCount)

    // NEGATIVE CASE: Changing count when showCount is false should NOT trigger effect
    count.value = 2;
    expect(spy).toHaveBeenCalledTimes(3); // Still 3! Dependency was dynamically removed.
  });

  it('should unsubscribe successfully', () => {
    const count = signal(0);
    const spy = vi.fn(() => {
      return count.value;
    });

    const unsubscribe = effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    unsubscribe();

    count.value = 1;
    expect(spy).toHaveBeenCalledTimes(1); // No longer reacts
  });

  it('NEGATIVE CASE: Nested effects should track dependencies independently without leaking', () => {
    const parentSig = signal('parent');
    const childSig = signal('child');
    
    const parentSpy = vi.fn();
    const childSpy = vi.fn();

    effect(() => {
      parentSpy(parentSig.value);
      
      // Creating an effect inside another effect
      effect(() => {
        childSpy(childSig.value);
      });
    });

    expect(parentSpy).toHaveBeenCalledTimes(1);
    expect(childSpy).toHaveBeenCalledTimes(1);

    // Trigger child only
    childSig.value = 'child-update';
    expect(parentSpy).toHaveBeenCalledTimes(1); // Parent should not run
    expect(childSpy).toHaveBeenCalledTimes(2); // Child should run
  });

  it('should converge when an effect writes to a signal it reads (with a termination condition)', () => {
    const count = signal(0);

    expect(() => {
      effect(() => {
        if (count.value < 10) {
          count.value += 1; // re-entrant write — triggers needsRerun
        }
      });
    }).not.toThrow();

    // Effect converges: 0→1→2→...→10, then the condition stops
    expect(count.value).toBe(10);
  });

  it('NEGATIVE CASE: should throw on truly circular effects that never converge', () => {
    const count = signal(0);

    expect(() => {
      effect(() => {
        count.value += 1; // always writes — never converges
      });
    }).toThrow(/Circular dependency detected/);
  });

  describe('untracked()', () => {
    it('should read a signal without creating a subscription', () => {
      const count = signal(0);
      const spy = vi.fn();

      effect(() => {
        spy(untracked(() => count.value));
      });

      expect(spy).toHaveBeenCalledTimes(1);

      // Mutating count must NOT re-run the effect (no subscription was created)
      count.value = 99;
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should allow mixing tracked and untracked reads', () => {
      const a = signal(1);
      const b = signal(10);
      const spy = vi.fn();

      effect(() => {
        // 'a' is tracked, 'b' is not
        spy(a.value + untracked(() => b.value));
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenLastCalledWith(11);

      b.value = 20; // untracked — no re-run
      expect(spy).toHaveBeenCalledTimes(1);

      a.value = 2; // tracked — re-runs, picks up latest b
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(22);
    });
  });
});
