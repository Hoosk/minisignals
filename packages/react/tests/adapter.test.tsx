import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { signal, computed } from '@hoosk/minisignals';
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

      act(() => {
        count.value = 20;
      });

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

      act(() => {
        name.value = 'B';
      });

      expect(display.textContent).toBe('BB');
    });
  });

  describe('useSignal()', () => {
    it('should maintain state across re-renders', () => {
      let renderCount = 0;
      
      const TestComponent = () => {
        renderCount++;
        // Create local signal
        const localCount = useSignal(100);
        // Subscribe to it to trigger re-renders
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

      act(() => {
        btn.click();
      });

      // The hook maintained the signal instance, and useSignalValue triggered the re-render
      expect(valSpan.textContent).toBe('101');
      expect(renderCount).toBe(2);
    });
  });
});
