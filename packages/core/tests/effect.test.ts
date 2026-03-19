import { describe, it, expect, vi } from 'vitest';
import { signal, effect } from '../src/index.ts';

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
});
