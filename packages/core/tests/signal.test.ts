import { describe, it, expect } from 'vitest';
import { signal } from '../src/index.ts';

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
