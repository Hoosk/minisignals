import { describe, it, expect, vi } from 'vitest';
import { signal, effect, computed } from '../src/index.ts';

describe('@hoosk/minisignals - Core Reactivity', () => {
  describe('signal()', () => {
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
  });

  describe('effect()', () => {
    it('should run immediately upon creation', () => {
      const spy = vi.fn();
      effect(spy);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to signals and re-run on changes', () => {
      const count = signal(0);
      const spy = vi.fn(() => {
        const val = count.value;
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

      // Setting same value
      count.value = 10;
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should handle dynamic dependencies correctly', () => {
      const showCount = signal(true);
      const count = signal(0);
      
      const spy = vi.fn(() => {
        if (showCount.value) {
          return count.value;
        }
        return 'hidden';
      });

      effect(spy);
      expect(spy).toHaveBeenCalledTimes(1); 

      count.value = 1;
      expect(spy).toHaveBeenCalledTimes(2); 

      showCount.value = false;
      expect(spy).toHaveBeenCalledTimes(3); 

      count.value = 2;
      expect(spy).toHaveBeenCalledTimes(3); 
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
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('computed()', () => {
    it('should derive values and cache them', () => {
      const count = signal(2);
      const spy = vi.fn(() => count.value * 2);
      const double = computed(spy);

      expect(spy).toHaveBeenCalledTimes(1); 
      expect(double.value).toBe(4);
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

    it('should allow computed signals to depend on other computed signals (Chaining)', () => {
      const num = signal(2);
      const double = computed(() => num.value * 2);
      const quadruple = computed(() => double.value * 2);

      expect(quadruple.value).toBe(8);

      num.value = 3;
      expect(quadruple.value).toBe(12);
    });
  });
});
