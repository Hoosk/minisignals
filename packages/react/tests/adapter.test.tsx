import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { signal, computed, batch } from '@hoosk/minisignals';
import { useSignalValue, useSignal } from '../src/index.ts';

describe('@hoosk/minisignals-react adapter', () => {
  describe('useSignalValue()', () => {
    it('should render the initial value of a signal', () => {
      const count = signal(5);

      const TestComponent = () => {
        const val = useSignalValue(count);
        return <div>Value: {val}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByText('Value: 5')).toBeDefined();
    });

    it('should trigger a re-render when the signal mutates', () => {
      const count = signal(10);

      const TestComponent = () => {
        const val = useSignalValue(count);
        return <div data-testid="display">{val}</div>;
      };

      render(<TestComponent />);
      const display = screen.getByTestId('display');
      expect(display.textContent).toBe('10');

      act(() => { count.value = 20; });

      expect(display.textContent).toBe('20');
    });

    it('should work seamlessly with computed signals', () => {
      const name = signal('A');
      const doubledName = computed(() => name.value + name.value);

      const TestComponent = () => {
        const val = useSignalValue(doubledName);
        return <div data-testid="computed-display">{val}</div>;
      };

      render(<TestComponent />);
      const display = screen.getByTestId('computed-display');
      expect(display.textContent).toBe('AA');

      act(() => { name.value = 'B'; });

      expect(display.textContent).toBe('BB');
    });

    it('NEGATIVE CASE: should unsubscribe when the component unmounts (no memory leak)', () => {
      const count = signal(0);
      const renderSpy = vi.fn();

      const TestComponent = () => {
        renderSpy();
        const val = useSignalValue(count);
        return <div>{val}</div>;
      };

      const { unmount } = render(<TestComponent />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      unmount();

      // Mutating after unmount must NOT trigger any render
      act(() => { count.value = 99; });
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should re-subscribe when the observed signal instance changes', () => {
      const sigA = signal('A');
      const sigB = signal('B');

      const TestComponent = ({ which }: { which: 'a' | 'b' }) => {
        const val = useSignalValue(which === 'a' ? sigA : sigB);
        return <div data-testid="out">{val}</div>;
      };

      const { rerender } = render(<TestComponent which="a" />);
      expect(screen.getByTestId('out').textContent).toBe('A');

      rerender(<TestComponent which="b" />);
      expect(screen.getByTestId('out').textContent).toBe('B');

      // Mutating the old signal must not re-render
      act(() => { sigA.value = 'A2'; });
      expect(screen.getByTestId('out').textContent).toBe('B');

      // Mutating the new signal must re-render
      act(() => { sigB.value = 'B2'; });
      expect(screen.getByTestId('out').textContent).toBe('B2');
    });

    it('should update multiple sibling components sharing the same signal independently', () => {
      const shared = signal(0);
      const renderCounts = { a: 0, b: 0 };

      const CompA = () => {
        renderCounts.a++;
        return <span data-testid="a">{useSignalValue(shared)}</span>;
      };
      const CompB = () => {
        renderCounts.b++;
        return <span data-testid="b">{useSignalValue(shared)}</span>;
      };

      render(<><CompA /><CompB /></>);
      expect(renderCounts).toEqual({ a: 1, b: 1 });

      act(() => { shared.value = 42; });

      expect(screen.getByTestId('a').textContent).toBe('42');
      expect(screen.getByTestId('b').textContent).toBe('42');
      expect(renderCounts).toEqual({ a: 2, b: 2 });
    });

    it('should only trigger one re-render when signal changes inside a batch', () => {
      const name = signal('John');
      const surname = signal('Doe');
      const renderSpy = vi.fn();

      const TestComponent = () => {
        renderSpy();
        const n = useSignalValue(name);
        const s = useSignalValue(surname);
        return <div data-testid="full">{n} {s}</div>;
      };

      render(<TestComponent />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        batch(() => {
          name.value = 'Jane';
          surname.value = 'Smith';
        });
      });

      expect(screen.getByTestId('full').textContent).toBe('Jane Smith');
      // 2 total: 1 initial + 1 from batch (not 3)
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('useSignal()', () => {
    it('should maintain state across re-renders', () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        const localCount = useSignal(100);
        const val = useSignalValue(localCount);

        return (
          <div>
            <span data-testid="val">{val}</span>
            <button onClick={() => localCount.value++}>Add</button>
          </div>
        );
      };

      render(<TestComponent />);

      const valSpan = screen.getByTestId('val');
      const btn = screen.getByText('Add');

      expect(valSpan.textContent).toBe('100');
      expect(renderCount).toBe(1);

      act(() => { btn.click(); });

      expect(valSpan.textContent).toBe('101');
      expect(renderCount).toBe(2);
    });

    it('should return the same signal instance across re-renders', () => {
      let capturedSignal: ReturnType<typeof useSignal<number>> | null = null;
      let prevSignal: typeof capturedSignal = null;
      let instanceChanged = false;

      const TestComponent = () => {
        const sig = useSignal(0);
        if (capturedSignal !== null && capturedSignal !== sig) instanceChanged = true;
        capturedSignal = sig;
        const val = useSignalValue(sig);
        return <div data-testid="v">{val}</div>;
      };

      const { rerender } = render(<TestComponent />);
      rerender(<TestComponent />);
      rerender(<TestComponent />);

      expect(instanceChanged).toBe(false);
    });

    it('should ignore the initialValue on subsequent renders', () => {
      const TestComponent = ({ init }: { init: number }) => {
        const sig = useSignal(init);
        const val = useSignalValue(sig);
        return <div data-testid="v">{val}</div>;
      };

      const { rerender } = render(<TestComponent init={1} />);
      expect(screen.getByTestId('v').textContent).toBe('1');

      // Passing a different initial value on re-render must have no effect
      rerender(<TestComponent init={999} />);
      expect(screen.getByTestId('v').textContent).toBe('1');
    });
  });
});
