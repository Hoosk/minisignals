import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import type { Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { signal } from '@hoosk/minisignals';
import { useSignal, useSignalRef, useSignalValue, useComputed, useSignalEffect } from '../src/index.ts';

const textOf = (wrapper: ReturnType<typeof mount>, selector: string): string =>
  wrapper.get(selector).text();

describe('@hoosk/minisignals-vue adapter', () => {
  describe('useSignalValue()', () => {
    it('should render the initial value and update on signal changes', async () => {
      const count = signal(5);

      const TestComponent = defineComponent({
        setup() {
          const value = useSignalValue(count);
          return () => h('div', { 'data-testid': 'value' }, String(value.value));
        },
      });

      const wrapper = mount(TestComponent);
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('5');

      count.value = 10;
      await nextTick();

      expect(textOf(wrapper, '[data-testid="value"]')).toBe('10');
      wrapper.unmount();
    });

    it('should work with computed signals', async () => {
      const name = signal('A');

      const TestComponent = defineComponent({
        setup() {
          const value = useSignalValue(useComputed(() => name.value + name.value));
          return () => h('div', { 'data-testid': 'value' }, value.value);
        },
      });

      const wrapper = mount(TestComponent);
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('AA');

      name.value = 'B';
      await nextTick();

      expect(textOf(wrapper, '[data-testid="value"]')).toBe('BB');
      wrapper.unmount();
    });

    it('NEGATIVE CASE: should unsubscribe when the component unmounts', async () => {
      const count = signal(0);
      const renderSpy = vi.fn();

      const TestComponent = defineComponent({
        setup() {
          const value = useSignalValue(count);
          return () => {
            renderSpy();
            return h('div', String(value.value));
          };
        },
      });

      const wrapper = mount(TestComponent);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      wrapper.unmount();

      count.value = 99;
      await nextTick();

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSignal() and useSignalRef()', () => {
    it('should create a writable ref usable with v-model semantics', async () => {
      const sig = signal(1);

      const TestComponent = defineComponent({
        setup() {
          const value = useSignalRef(sig);
          return () => h('div', [
            h('span', { 'data-testid': 'value' }, String(value.value)),
            h('button', {
              'data-testid': 'increment',
              onClick: () => { value.value += 1; },
            }),
          ]);
        },
      });

      const wrapper = mount(TestComponent);
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('1');

      await wrapper.get('[data-testid="increment"]').trigger('click');

      expect(sig.value).toBe(2);
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('2');
      wrapper.unmount();
    });

    it('should create a stable local signal across re-renders', async () => {
      const TestComponent = defineComponent({
        setup() {
          const count = useSignal(100);
          return () => h('button', {
            'data-testid': 'value',
            onClick: () => { count.value += 1; },
          }, String(count.value));
        },
      });

      const wrapper = mount(TestComponent);
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('100');

      await wrapper.get('[data-testid="value"]').trigger('click');
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('101');

      await wrapper.get('[data-testid="value"]').trigger('click');
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('102');
      wrapper.unmount();
    });
  });

  describe('useComputed()', () => {
    it('should derive values and update reactively', async () => {
      const price = signal(100);

      const TestComponent = defineComponent({
        setup() {
          const doubled = useComputed(() => price.value * 2);
          return () => h('div', { 'data-testid': 'value' }, String(doubled.value));
        },
      });

      const wrapper = mount(TestComponent);
      expect(textOf(wrapper, '[data-testid="value"]')).toBe('200');

      price.value = 150;
      await nextTick();

      expect(textOf(wrapper, '[data-testid="value"]')).toBe('300');
      wrapper.unmount();
    });

    it('should dispose the computed on unmount, freezing its value', () => {
      const source = signal(1);
      let captured: Readonly<Ref<number>> | null = null;

      const TestComponent = defineComponent({
        setup() {
          const derived = useComputed(() => source.value * 10);
          captured = derived;
          return () => h('div', String(derived.value));
        },
      });

      const wrapper = mount(TestComponent);
      expect(captured!.value).toBe(10);

      wrapper.unmount();
      source.value = 2;

      expect(captured!.value).toBe(10);
    });
  });

  describe('useSignalEffect()', () => {
    it('should run the effect, react to changes and clean up on unmount', async () => {
      const count = signal(0);
      const spy = vi.fn();
      const cleanup = vi.fn();

      const TestComponent = defineComponent({
        setup() {
          useSignalEffect(() => {
            spy(count.value);
            return cleanup;
          });
          return () => h('div');
        },
      });

      const wrapper = mount(TestComponent);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(cleanup).toHaveBeenCalledTimes(0);

      count.value = 1;
      await nextTick();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(cleanup).toHaveBeenCalledTimes(1);

      wrapper.unmount();
      expect(cleanup).toHaveBeenCalledTimes(2);

      count.value = 2;
      await nextTick();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should return a stop function for manual teardown', async () => {
      const count = signal(0);
      const spy = vi.fn();
      let stop: (() => void) | null = null;

      const TestComponent = defineComponent({
        setup() {
          stop = useSignalEffect(() => {
            spy(count.value);
          });
          return () => h('div');
        },
      });

      const wrapper = mount(TestComponent);
      expect(spy).toHaveBeenCalledTimes(1);

      stop!();
      count.value = 1;
      await nextTick();

      expect(spy).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });
  });
});
