import { describe, it, expect, vi } from 'vitest';
import { signal, effect, batch } from '../src/index.ts';

describe('@hoosk/minisignals - signal()', () => {
  it('should hold and update values', () => {
    const count = signal(0);
    expect(count.value).toBe(0);
    count.value = 1;
    expect(count.value).toBe(1);
  });

  it('should handle different data types perfectly', () => {
    const str = signal('hello');
    const obj = signal({ foo: 'bar' });
    const arr = signal([1, 2, 3]);

    expect(str.value).toBe('hello');
    expect(obj.value.foo).toBe('bar');
    expect(arr.value[0]).toBe(1);

    arr.value = [...arr.value, 4];
    expect(arr.value.length).toBe(4);
  });

  it('NEGATIVE CASE: should handle equality check to prevent updates when same value is set', () => {
    const ref = { id: 1 };
    const obj = signal(ref);
    expect(obj.value).toBe(ref);
    
    obj.value = ref;
    expect(obj.value).toBe(ref);
  });
});

describe('@hoosk/minisignals - batch()', () => {
  it('should defer subscriber notifications until the batch completes', () => {
    const name = signal('A');
    const surname = signal('B');
    const spy = vi.fn();

    effect(() => {
      spy(`${name.value} ${surname.value}`);
    });

    expect(spy).toHaveBeenCalledTimes(1); // initial run

    batch(() => {
      name.value = 'C';
      surname.value = 'D';
    });

    // Only one re-run after batch, NOT two
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('C D');
  });

  it('should support nested batches — notifications fire only when outermost batch ends', () => {
    const a = signal(0);
    const b = signal(0);
    const spy = vi.fn();

    effect(() => {
      spy(a.value + b.value);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    batch(() => {
      batch(() => {
        a.value = 1;
        b.value = 1;
      });
      // Still inside outer batch — should not have fired yet
      expect(spy).toHaveBeenCalledTimes(1);
      a.value = 2;
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(3); // a=2, b=1
  });

  it('should return the value from the batched function', () => {
    const result = batch(() => 42);
    expect(result).toBe(42);
  });

  it('NEGATIVE CASE: should not run an effect that was unsubscribed during the same batch', () => {
    const count = signal(0);
    const spy = vi.fn();

    const unsubscribe = effect(() => {
      spy(count.value);
    });

    expect(spy).toHaveBeenCalledTimes(1); // initial run

    batch(() => {
      count.value = 1;   // enqueues eff.run into pending notifications
      unsubscribe();      // cleanup — should also remove eff.run from pending
    });

    // The effect must NOT have re-run after the batch flush
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
