import { describe, it, expect, vi } from 'vitest';
import { signal, computed } from '../src/index.ts';

describe('@hoosk/minisignals - computed()', () => {
  it('should be LAZY: must not calculate until .value is read', () => {
    const count = signal(2);
    const spy = vi.fn(() => count.value * 2);
    
    const double = computed(spy);
    
    expect(spy).toHaveBeenCalledTimes(0);

    expect(double.value).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should derive values and cache them', () => {
    const count = signal(2);
    const spy = vi.fn(() => count.value * 2);
    const double = computed(spy);

    expect(double.value).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1); 

    expect(double.value).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should update when dependencies update', () => {
    const name = signal('A');
    const surname = signal('B');
    const fullName = computed(() => `${name.value} ${surname.value}`);

    expect(fullName.value).toBe('A B');

    name.value = 'C';
    expect(fullName.value).toBe('C B');
  });

  it('NEGATIVE CASE: should prevent memory leaks when disposed', () => {
    const count = signal(0);
    const spy = vi.fn(() => count.value * 10);
    const tens = computed(spy);

    expect(tens.value).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);

    tens.dispose();

    count.value = 1;
    expect(spy).toHaveBeenCalledTimes(1);
    
    expect(tens.value).toBe(0); 
  });

  it('NEGATIVE CASE: should handle reading a disposed computed that was never initialized', () => {
    const count = signal(10);
    const spy = vi.fn(() => count.value * 5);
    const disposedEarly = computed(spy);

    disposedEarly.dispose();

    // First read after dispose: calls fn() once and caches the result
    expect(disposedEarly.value).toBe(50);
    expect(spy).toHaveBeenCalledTimes(1);

    // Signal changes, but the computed is frozen — fn() is NOT called again
    count.value = 20;
    expect(spy).toHaveBeenCalledTimes(1);

    // Returns the frozen cached value, not 100
    expect(disposedEarly.value).toBe(50);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should allow computed signals to depend on other computed signals (Chaining)', () => {
    const num = signal(2);
    const double = computed(() => num.value * 2);
    const quadruple = computed(() => double.value * 2);

    expect(quadruple.value).toBe(8);

    num.value = 3;
    expect(quadruple.value).toBe(12);
  });
});
